"""Trạng thái phục vụ gợi ý. Mỗi lần ghi: cập nhật DB, dựng lại toàn bộ trạng thái, thay nguyên khối."""
import json
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import lightgbm as lgb
import numpy as np

from .. import clock, config, db
from . import cold
from .features import DAY, build_phase, candidates, feature_matrix, features_for, rank
from .loader import embed, load_frames

MAIN, NEW_WITH, NEW_WITHOUT = "mo_hinh_chinh", "nguoi_dung_moi_co_lich_su", "nguoi_dung_moi_chua_co_lich_su"
CRITERIA = config.META["static"] + config.META["dynamic"] + config.META["extra"]


@dataclass
class RecItem:
    place_id: int
    score: float
    gnn_score: float | None
    criteria: dict | None


@dataclass
class RecResult:
    branch: str
    items: list


@dataclass
class State:
    places: object
    users: object
    hist: object
    cat: object
    Eu: np.ndarray
    Ei: np.ndarray
    P: dict
    pop_recent: np.ndarray
    pop_all: np.ndarray
    now: int
    layout: object = None
    g: dict | None = None          # ma trận kề chuẩn hóa theo quan hệ
    layers: list | None = None     # E⁽⁰⁾..E⁽³⁾ của mọi nút


class Engine:
    def __init__(self, db_path: Path | None = None):
        self.db_path = Path(db_path or config.db_path())
        self.booster = lgb.Booster(model_file=str(config.ARTIFACTS / "ranker.txt"))
        self.lock = threading.Lock()
        self.last_reload_ms = 0.0
        self.state: State | None = None
        self.comparer = None           # tạo khi trang so sánh mô hình cần (api/admin.py)
        self.reload()

    def conn(self):
        return db.connect(self.db_path)

    # ---------- trạng thái ----------
    def reload(self) -> float:
        t0 = time.perf_counter()
        c = self.conn()
        try:
            places, users, hist = load_frames(c)
            now = clock.now_ts(c)
        finally:
            c.close()
        cat, layout, Eu, Ei, g, layers = embed(places, users, hist, keep=True)
        P = build_phase(hist, cat, len(users))
        i = hist["i"].to_numpy()
        recent = hist["ts"].to_numpy() > now - config.COLD_RECENT_DAYS * DAY   # chỉ dùng cho mô hình đơn giản
        self.state = State(places, users, hist, cat, Eu, Ei, P,
                           np.bincount(i[recent], minlength=cat.n_items), np.bincount(i, minlength=cat.n_items), now,
                           layout, g, layers)
        dt = time.perf_counter() - t0
        self.last_reload_ms = dt * 1000
        return dt

    def _user(self, user_id: int):
        S = self.state
        if not 0 <= user_id < len(S.users):
            raise KeyError(user_id)
        return S.users.iloc[user_id]

    def has_vector(self, user_id: int) -> bool:
        S = self.state
        return S.P["hist_len"][user_id] > 0 and float(np.linalg.norm(S.Eu[user_id])) > 1e-8

    def branch(self, user_id: int) -> str:
        row = self._user(user_id)
        if not int(row["is_new"]):
            return MAIN
        return NEW_WITH if self.has_vector(user_id) else NEW_WITHOUT

    # ---------- gợi ý ----------
    def recommend(self, user_id: int, k: int = 20, explain: bool = False) -> RecResult:
        S, br = self.state, self.branch(user_id)
        allow = ~S.cat.hidden
        if br == NEW_WITHOUT:
            row = self._user(user_id)
            prefs = json.loads(row["prefs"]) if isinstance(row["prefs"], str) else None
            s = cold.score(prefs, S.cat, S.pop_recent, S.pop_all)
            seen = S.P["excl"][user_id].indices
            s[~allow] = -np.inf
            s[seen] = -np.inf
            top = np.argsort(-s, kind="stable")[:k]
            return RecResult(br, [RecItem(int(i), float(s[i]), None, None) for i in top if np.isfinite(s[i])])
        D = candidates(S.P, S.Eu, S.Ei, [user_id], S.cat, allow=allow)
        top, sc, pos = rank(D, self.booster, k)
        items = []
        for j in range(top.shape[1]):
            if top[0, j] < 0:
                continue
            p = pos[0, j]
            crit = {c: float(np.nan_to_num(D["raw"][c][0, p])) for c in CRITERIA} if explain else None
            items.append(RecItem(int(top[0, j]), float(sc[0, j]), float(D["raw"]["gnn"][0, p]), crit))
        return RecResult(br, items)

    def search_order(self, user_id: int, ids: np.ndarray) -> tuple[np.ndarray, str]:
        """Xếp các quán khớp tìm kiếm theo mức phù hợp với người dùng, cùng đường tính với "Gợi ý cho bạn".

        Có vector: tầng 1 trên tập ids, 200 quán điểm cao nhất qua tầng 2 (LightGBM), phần còn lại theo tầng 1.
        Quán đã đánh giá vẫn được xếp (tìm kiếm là người dùng chủ động tìm). Chưa có vector: mô hình đơn giản.
        """
        S, br = self.state, self.branch(user_id)
        ids = np.asarray(ids, dtype=int)
        if len(ids) == 0:
            return ids, br
        if br == NEW_WITHOUT:
            row = self._user(user_id)
            prefs = json.loads(row["prefs"]) if isinstance(row["prefs"], str) else None
            s = cold.score(prefs, S.cat, S.pop_recent, S.pop_all)[ids]
            return ids[np.argsort(-s, kind="stable")], br
        g = (S.Eu[user_id] @ S.Ei[ids].T).astype(float)
        by_gnn = ids[np.argsort(-g, kind="stable")]
        head, tail = by_gnn[:config.N_CAND], by_gnn[config.N_CAND:]
        gh = S.Eu[user_id] @ S.Ei[head].T
        D = features_for(S.P, S.Eu, S.Ei, [user_id], S.cat, head[None, :], gh[None, :].astype(float))
        s = self.booster.predict(feature_matrix(D)[0])
        return np.concatenate([head[np.argsort(-s, kind="stable")], tail]), br

    def personal_scores(self, user_id: int) -> np.ndarray | None:
        if not self.has_vector(user_id):
            return None
        S = self.state
        return S.Eu[user_id] @ S.Ei.T

    def similar(self, place_id: int, k: int = 12) -> list[int]:
        S = self.state
        E = S.Ei / np.maximum(np.linalg.norm(S.Ei, axis=1, keepdims=True), 1e-12)
        s = E @ E[place_id]
        s[place_id] = -np.inf
        s[S.cat.hidden] = -np.inf
        return [int(i) for i in np.argsort(-s, kind="stable")[:k] if np.isfinite(s[i])]

    def new_places(self, user_id: int | None, k: int = 12) -> list[int]:
        S = self.state
        ids = np.where(S.cat.is_new & ~S.cat.hidden)[0]
        ps = self.personal_scores(user_id) if user_id is not None else None
        ids = ids[np.argsort(-ps[ids], kind="stable")] if ps is not None else ids[::-1]
        return [int(i) for i in ids[:k]]

    def revisit(self, user_id: int, k: int = 12) -> list[int]:
        S = self.state
        h = S.hist[(S.hist["u"] == user_id) & (S.hist["rating"] >= config.REVISIT_MIN_RATING)]
        h = h[~S.cat.hidden[h["i"].to_numpy()]].sort_values(["rating", "ts"], ascending=False)
        return [int(i) for i in h["i"].head(k)]

    # ---------- ghi ----------
    def _write(self, fn):
        with self.lock:
            c = self.conn()
            try:
                out = fn(c)
            finally:
                c.close()
            self.reload()
            return out

    def add_review(self, user_id, place_id, rating, title, text) -> int:
        self._user(user_id)
        if not 0 <= place_id < self.state.cat.n_items:
            raise KeyError(place_id)
        now_real = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
        return self._write(lambda c: db.upsert_review(c, user_id, place_id, float(rating), title, text,
                                                      clock.now_ts(c), now_real))

    def add_user(self, name: str, prefs: dict | None) -> int:
        return self._write(lambda c: db.create_user(c, name, prefs))

    def add_place(self, data: dict) -> int:
        return self._write(lambda c: db.create_place(c, data))

    def update_place(self, place_id: int, data: dict) -> None:
        if not 0 <= place_id < self.state.cat.n_items:
            raise KeyError(place_id)
        self._write(lambda c: db.update_place(c, place_id, data))
