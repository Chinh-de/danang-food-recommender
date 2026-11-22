"""So sánh mô hình: top-K của nhiều mô hình cho một người dùng, chỉ số mô tả, kiểm tra trên quá khứ."""
import threading

import numpy as np

from .. import config
from .features import haversine
from .loader import load_frames
from .zoo import MODELS, World, available, load_booster, notebook_results

KS = (10, 20, 50)
DISC = 1 / np.log2(np.arange(2, max(KS) + 2))
META = {m[0]: dict(key=m[0], label=m[1], group=m[2], mechanisms=m[3], description=m[4]) for m in MODELS}


def evaluate_rows(top, users, target_keys, n_target, I):
    """Chỉ số cho từng người dùng (cùng công thức notebook/check_notebook.py)."""
    valid = top >= 0
    safe = np.where(valid, top, 0)
    rel = np.isin(users[:, None].astype(np.int64) * I + safe, target_keys) & valid
    nt = n_target[users]
    first = np.where(rel.any(1), rel.argmax(1) + 1, np.inf)
    out = {}
    for k in KS:
        r = rel[:, :k]
        idcg = np.cumsum(DISC[:k])[np.minimum(nt, k) - 1]
        out[f"Recall@{k}"] = r.sum(1) / nt
        out[f"NDCG@{k}"] = (r * DISC[:k]).sum(1) / idcg
        out[f"HitRate@{k}"] = r.any(1).astype(float)
        out[f"MRR@{k}"] = np.where(first <= k, 1 / first, 0)
    return out, rel


def get_comparer(engine) -> "Comparer":
    """Một Comparer cho mỗi engine, tạo khi cần lần đầu (trang so sánh hoặc trực quan hóa)."""
    if getattr(engine, "comparer", None) is None:
        engine.comparer = Comparer(engine)
    return engine.comparer


class Comparer:
    """Gắn với Engine. Thế giới "hiện tại" làm mới theo trạng thái engine; thế giới "quá khứ" dựng một lần."""

    def __init__(self, engine):
        self.e = engine
        self.booster = load_booster()
        self._now = (None, None)
        self._hold = None
        self._summary = None
        self.lock = threading.Lock()

    def models(self):
        return [META[k] | dict(available=available(k)) for k in META]

    def now_world(self) -> World:
        S = self.e.state
        if self._now[0] is not S:
            self._now = (S, World(S.places, S.users, S.hist, cat=S.cat, layout=S.layout, P=S.P, main=(S.Eu, S.Ei)))
        return self._now[1]

    def hold_world(self):
        with self.lock:
            if self._hold is None:
                c = self.e.conn()
                try:
                    places, users, all_hist = load_frames(c)
                finally:
                    c.close()
                hist = all_hist[all_hist["part"].isin(["train", "valid"])].reset_index(drop=True)
                test = all_hist[all_hist["part"] == "test"]
                W = World(places, users, hist)
                W.cat.hidden = W.cat.hidden | (np.arange(W.I) >= config.META["I"])   # chỉ quán có trong dữ liệu huấn luyện
                keys = np.unique(test["u"].to_numpy(np.int64) * W.I + test["i"].to_numpy(np.int64))
                self._hold = (W, test, keys, np.bincount(test["u"], minlength=W.U))
            return self._hold

    # ---------- một người dùng ----------
    def column_stats(self, W: World, u: int, top: np.ndarray, main_top: np.ndarray):
        top = top[top >= 0]
        if len(top) == 0:
            return dict(km=None, out_pct=None, cat_pct=None, pop=None, overlap=None)
        c = W.cat
        d = haversine(c.lat[top], c.lon[top], W.clat[u], W.clon[u])
        radius = float(W.phase()["radius"][u])
        hist_items = W.seen[u].indices
        user_cats = (np.asarray(c.attrs["IC"][hist_items].sum(0)).ravel() > 0)
        cat_hit = np.asarray(c.attrs["IC"][top] @ user_cats.astype(float)).ravel() > 0
        return dict(km=round(float(d.mean()), 2), out_pct=round(float((d > radius).mean() * 100), 1),
                    cat_pct=round(float(cat_hit.mean() * 100), 1), pop=round(float(W.pop[top].mean()), 1),
                    overlap=int(len(set(top.tolist()) & set(main_top[main_top >= 0].tolist()))), radius_km=round(radius, 2))

    def compare(self, user_id: int, mode: str, k: int, keys: list[str]):
        keys = [x for x in keys if x in META and available(x)] or ["pop", "itemknn", "svd", "full"]
        hold = mode == "holdout"
        if hold:
            W, test, tkeys, n_target = self.hold_world()
            targets = test[test["u"] == user_id]["i"].astype(int).tolist()
            if not targets:
                return dict(mode=mode, error="Người dùng này không có tập test (chỉ người dùng gốc của Foody mới có).")
        else:
            W = self.now_world()
            targets = []
        users = np.array([user_id])
        main_top = W.topk("full", users, k, self.booster)[0]
        cols = []
        for key in keys:
            top = main_top if key == "full" else W.topk(key, users, k, self.booster)[0]
            col = META[key] | dict(items=[int(x) for x in top if x >= 0], stats=self.column_stats(W, user_id, top, main_top))
            if hold:
                m, rel = evaluate_rows(np.pad(top, (0, max(KS) - len(top)), constant_values=-1)[None, :], users, tkeys, n_target, W.I)
                col["hits"] = [int(x) for x, h in zip(top, rel[0]) if x >= 0 and h]
                col["metrics"] = {f"{n}@{k}": round(float(m[f"{n}@{k}"][0]), 4) for n in ["Recall", "NDCG", "HitRate", "MRR"] if f"{n}@{k}" in m}
            cols.append(col)
        return dict(mode=mode, k=k, targets=targets, center=dict(lat=float(W.clat[user_id]), lon=float(W.clon[user_id]),
                                                                  radius_km=round(float(W.phase()["radius"][user_id]), 2)),
                    columns=cols)

    # ---------- toàn tập test ----------
    def summary(self):
        with self.lock:
            if self._summary is not None:
                return self._summary
        W, test, tkeys, n_target = self.hold_world()
        users = np.unique(test["u"].to_numpy())
        nb = notebook_results()
        rows, per_user = [], {}
        for key in META:
            if not available(key):
                rows.append(META[key] | dict(available=False))
                continue
            tops = []
            for b in range(0, len(users), 512):
                tops.append(W.topk(key, users[b:b + 512], max(KS), self.booster))
            top = np.vstack(tops)
            m, _ = evaluate_rows(top, users, tkeys, n_target, W.I)
            per_user[key] = m["NDCG@10"]
            row = META[key] | dict(available=True, metrics={k: round(float(v.mean()), 4) for k, v in m.items()})
            if key in nb:
                row["notebook"] = {k: round(v, 4) for k, v in nb[key].items()}
                row["match"] = abs(row["metrics"]["NDCG@20"] - nb[key]["NDCG@20"]) < 5e-4
            rows.append(row)
        # ví dụ đẹp: người dùng mà mô hình hai tầng trúng nhiều, mô hình khác trúng ít
        others = [k for k in per_user if k != "full"]
        gap = per_user["full"] - np.max(np.stack([per_user[k] for k in others]), 0)
        gap = np.where(n_target[users] >= 2, gap, gap - 1)     # ưu tiên người có từ 2 quán trong tập test
        best = np.argsort(-gap)[:8]
        names = W.users["name"].to_numpy()
        examples = [dict(user_id=int(users[j]), name=str(names[users[j]]), ndcg_full=round(float(per_user["full"][j]), 3),
                         ndcg_best_other=round(float(per_user["full"][j] - gap[j]), 3)) for j in best if per_user["full"][j] > 0]
        out = dict(n_users=int(len(users)), ks=list(KS), rows=rows, examples=examples)
        with self.lock:
            self._summary = out
        return out
