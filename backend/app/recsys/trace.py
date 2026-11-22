"""Ghi lại từng bước tính gợi ý cho một cặp (người dùng, quán) để trực quan hóa.

Mọi số lấy từ trạng thái engine đang phục vụ. Bước nào có kết quả thì kèm phép kiểm chứng:
tính lại từ các thành phần rồi so với giá trị engine dùng (check = {recomputed, engine, err}).
"""
import json
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np

from .. import config, schemas
from . import cold
from .features import DAY, features_for, feature_matrix, haversine, top_candidates
from .graph import ui_weight

CRIT_LABELS = {
    "gnn": "Điểm tầng 1", "near": "Gần vùng quen", "pop_all": "Phổ biến (mọi lúc)", "cat_match": "Khớp danh mục",
    "price_diff": "Lệch mức giá", "item_rating": "Điểm quán", "item_reviews": "Số review",
    "pop_recent": "Phổ biến 180 ngày", "sim_last": "Giống quán vừa đến", "covisit": "Người khác hay đi tiếp tới",
    "near_last": "Gần quán vừa đến", "asp_match": "Khớp 5 khía cạnh", "same_district": "Cùng quận hay đến",
    "aud_match": "Khớp đối tượng khách",
}
GROUP = {c: "static" for c in config.META["static"]} | {c: "dynamic" for c in config.META["dynamic"]} | \
        {c: "extra" for c in config.META["extra"]}
CRITERIA = config.META["static"] + config.META["dynamic"] + config.META["extra"]
REL_LABELS = {"UI": "người dùng–quán", "IC": "quán–danh mục", "IP": "quán–mức giá", "IF": "quán–tiện ích",
              "ID": "quán–quận", "IA": "quán–đối tượng khách"}
TOP_NEIGHBORS = 5


def _v(x, nd=4):
    return [round(float(t), nd) for t in np.asarray(x).ravel()]


def _check(recomputed, engine_value):
    a, b = np.asarray(recomputed, float), np.asarray(engine_value, float)
    return dict(recomputed=_v(a, 6) if a.size > 1 else round(float(a), 6),
                engine=_v(b, 6) if b.size > 1 else round(float(b), 6),
                err=float(np.max(np.abs(a - b))) if a.size else 0.0)


def _date(ts):
    return datetime.fromtimestamp(int(ts), timezone.utc).strftime("%Y-%m-%d")


@dataclass
class GnnView:
    """Một GNN dị thể đã lan truyền: đồ thị, các lớp E⁽ˡ⁾ của mọi nút, embedding cuối và α."""
    mode: str            # binary | static | dynamic: cách tính trọng số cạnh người dùng–quán
    g: dict
    layers: list
    Eu: np.ndarray
    Ei: np.ndarray
    alpha: dict


def main_view(engine) -> GnnView:
    S = engine.state
    return GnnView("dynamic", S.g, S.layers, S.Eu, S.Ei, config.META["rel_weights"])


class Tracer:
    def __init__(self, engine, user_id: int, place_id: int, view: GnnView | None = None):
        self.e, self.S = engine, engine.state
        self.u, self.i = user_id, place_id
        S = self.S
        self.L = S.layout
        self.v = view or main_view(engine)
        self.alpha = self.v.alpha
        self.un, self.inode = int(self.L.user_node(user_id)), int(self.L.item_node(place_id))
        # nút -> (loại, chỉ số) để gắn nhãn hàng xóm
        self.kind = {}
        for u, n in enumerate(self.L.user_nodes):
            self.kind[int(n)] = ("user", u)
        for i, n in enumerate(self.L.item_nodes):
            self.kind[int(n)] = ("place", i)
        for k in config.RELS[1:]:
            for j in range(S.cat.attrs[k].shape[1]):
                self.kind[self.L.off[k] + j] = (k, j)

    # ---------- nhãn ----------
    def attr_label(self, k, j):
        c = self.S.cat
        if k == "IC":
            return c.cat_vocab[j]
        if k == "IP":
            return config.PRICE_LABELS.get(j + 1, f"mức {j + 1}")
        if k == "IF":
            return ["Giao hàng", "Đặt bàn"][j]
        if k == "ID":
            return c.districts[j]
        return c.audiences[j]

    def node(self, n):
        k, j = self.kind[int(n)]
        if k == "user":
            return dict(node=int(n), kind="user", id=j, label=str(self.S.users.iloc[j]["name"]))
        if k == "place":
            return dict(node=int(n), kind="place", id=j, label=str(self.S.places.iloc[j]["name"]))
        return dict(node=int(n), kind=k, id=j, label=self.attr_label(k, j))

    # ---------- các bước ----------
    def step_data(self):
        S, r = self.S, self.S.places.iloc[self.i]
        d = schemas.place_detail(r)
        h = S.hist[S.hist["u"] == self.u].sort_values("ts", ascending=False)
        hist = [dict(place_id=int(x.i), name=str(S.places.iloc[int(x.i)]["name"]), rating=float(x.rating),
                     date=_date(x.ts)) for x in h.itertuples()]
        return dict(place=dict(name=d["name"], categories=d["categories"], price=d["price"], price_label=d["price_label"],
                               delivery=d["delivery"], district=d["district"], target_audience=d["target_audience"],
                               aspects=d["aspects"], lat=d["lat"], lon=d["lon"], stars=d["stars"],
                               review_count=d["review_count"], is_new=d["is_new"]),
                    user=dict(name=str(S.users.iloc[self.u]["name"]), n_history=len(hist), history=hist[:15],
                              is_new=bool(S.users.iloc[self.u]["is_new"])))

    def step_nodes(self):
        S = self.S
        attrs = []
        for k in config.RELS[1:]:
            row = S.cat.attrs[k][self.i]
            for j in row.indices:
                attrs.append(dict(rel=k, rel_label=REL_LABELS[k]) | self.node(self.L.off[k] + int(j)))
        n_users_of_place = int((S.hist["i"] == self.i).sum())
        return dict(n_nodes=int(self.L.n_nodes), user_node=self.node(self.un), place_node=self.node(self.inode),
                    place_attrs=attrs, n_users_of_place=n_users_of_place,
                    n_places_of_user=int(S.P["hist_len"][self.u]),
                    not_nodes=["Tọa độ", "5 điểm khía cạnh", "Điểm và số review của quán"])

    def step_weights(self):
        S = self.S
        H = S.hist
        mode = self.v.mode
        w = ui_weight(H, mode)
        m = (H["u"] == self.u).to_numpy()
        h = H[m].assign(w=w[m])
        t_ref = int(h["ts"].max()) if len(h) else 0
        rows = []
        for x in h.sort_values("ts", ascending=False).itertuples():
            dt = (t_ref - int(x.ts)) / DAY
            decay = config.W_FLOOR + (1 - config.W_FLOOR) * np.exp(-dt / config.TAU_DAYS) if mode == "dynamic" else 1.0
            a = float(self.v.g["UI"][self.un, self.L.item_node(int(x.i))])
            rows.append(dict(place_id=int(x.i), name=str(S.places.iloc[int(x.i)]["name"]), rating=float(x.rating),
                             r=float(x.r), dt_days=round(dt, 1), decay=round(float(decay), 4), w=round(float(x.w), 4),
                             a_hat=round(a, 5), date=_date(x.ts)))
        expect = (lambda e: 1.0) if mode == "binary" else (lambda e: e["r"] * e["decay"])
        return dict(mode=mode, tau=config.TAU_DAYS, floor=config.W_FLOOR, t_ref=_date(t_ref) if t_ref else None, edges=rows,
                    check=_check([expect(r_) for r_ in rows], [r_["w"] for r_ in rows]) if rows else None)

    def step_norm(self):
        S = self.S
        H = S.hist
        w = ui_weight(H, self.v.mode)
        du = float(w[(H["u"] == self.u).to_numpy()].sum())
        rows = []
        for e in self.step_weights()["edges"][:10]:
            di = float(w[(H["i"] == e["place_id"]).to_numpy()].sum())
            rows.append(dict(name=e["name"], w=e["w"], d_u=round(du, 4), d_i=round(di, 4),
                             a_hat=round(e["w"] / np.sqrt(du * di), 5), engine=e["a_hat"]))
        attrs = []
        for k in config.RELS[1:]:
            M = S.cat.attrs[k]
            deg_p = float(M[self.i].sum())
            for j in M[self.i].indices:
                deg_a = float(M[:, j].sum())
                attrs.append(dict(rel=k, label=self.attr_label(k, int(j)), d_place=deg_p, d_attr=deg_a,
                                  a_hat=round(1 / np.sqrt(deg_p * deg_a), 5),
                                  engine=round(float(self.v.g[k][self.inode, self.L.off[k] + int(j)]), 5)))
        chk = [(r_["a_hat"], r_["engine"]) for r_ in rows + attrs]
        return dict(ui=rows, attrs=attrs, check=_check(*zip(*chk)) if chk else None)

    def step_e0(self):
        E0 = self.v.layers[0]
        new_u, new_i = bool(self.L.new_mask[self.un]), bool(self.L.new_mask[self.inode])
        return dict(user=_v(E0[self.un]), place=_v(E0[self.inode]), user_is_new_node=new_u, place_is_new_node=new_i,
                    dim=int(E0.shape[1]))

    def layer(self, l):
        """Lớp l (1..3): E⁽ˡ⁾[v] = Σᵣ αᵣ Σⱼ Âᵣ[v,j]·E⁽ˡ⁻¹⁾[j] cho v = quán và người dùng."""
        prev, cur = self.v.layers[l - 1], self.v.layers[l]
        out = {}
        for who, v in (("place", self.inode), ("user", self.un)):
            rels, total = [], np.zeros(prev.shape[1])
            for r in config.RELS:
                row = self.v.g[r][v]
                if row.nnz == 0:
                    continue
                js, a = row.indices, row.data
                contrib = a[:, None] * prev[js]
                s = contrib.sum(0)
                total += self.alpha[r] * s
                norms = np.linalg.norm(contrib, axis=1)
                order = np.argsort(-norms)[:TOP_NEIGHBORS]
                rels.append(dict(rel=r, rel_label=REL_LABELS[r], alpha=round(self.alpha[r], 4), n=int(row.nnz),
                                 neighbors=[self.node(js[k]) | dict(a_hat=round(float(a[k]), 5), norm=round(float(norms[k]), 4))
                                            for k in order],
                                 others=max(int(row.nnz) - TOP_NEIGHBORS, 0),
                                 sum=_v(s), weighted=_v(self.alpha[r] * s), norm=round(float(np.linalg.norm(self.alpha[r] * s)), 4)))
            out[who] = dict(rels=rels, result=_v(total), check=_check(total, cur[v]))
        return dict(l=l, **out)

    def step_stage1(self):
        S, V = self.S, self.v
        Ls = V.layers
        vec = lambda n: (sum(L[n] for L in Ls) / len(Ls)) if not self.L.new_mask[n] else sum(L[n] for L in Ls[1:]) / (len(Ls) - 1)
        eu, ei = vec(self.un), vec(self.inode)
        y = float(eu @ ei)
        s = V.Eu[self.u] @ V.Ei.T
        allow = ~S.cat.hidden
        seen = S.P["excl"][self.u].indices
        pool = allow.copy()
        pool[seen] = False
        seen_flag = bool(self.i in set(seen.tolist()))
        rank = int((s[pool] > s[self.i]).sum()) + 1 if not seen_flag else None
        hist_counts, edges = np.histogram(s[pool], bins=24)
        return dict(layers_user=[_v(L[self.un]) for L in Ls], layers_place=[_v(L[self.inode]) for L in Ls],
                    e_user=_v(eu), e_place=_v(ei), y=round(y, 5), check_e=_check(np.concatenate([eu, ei]),
                                                                             np.concatenate([V.Eu[self.u], V.Ei[self.i]])),
                    check_y=_check(y, float(s[self.i])), rank=rank, pool=int(pool.sum()), seen=seen_flag,
                    in_top200=rank is not None and rank <= config.N_CAND, n_cand=config.N_CAND,
                    hist=dict(counts=[int(c) for c in hist_counts], edges=_v(edges, 3)))

    def stage2(self):
        """Ứng viên thật của người dùng; quán không có trong đó thì thêm vào cuối để tính (giả định)."""
        S = self.S
        cand, score = top_candidates(S.P, S.Eu, S.Ei, [self.u], config.N_CAND, ~S.cat.hidden)
        cand, score = cand[0], score[0].astype(float)
        hit = np.where(cand == self.i)[0]
        real = len(hit) > 0
        if not real:
            cand = np.append(cand, self.i)
            score = np.append(score, float(S.Eu[self.u] @ S.Ei[self.i]))
        pos = int(hit[0]) if real else len(cand) - 1
        D = features_for(S.P, S.Eu, S.Ei, [self.u], S.cat, cand[None, :], score[None, :])
        return D, pos, real

    def step_criteria(self, D, pos, real):
        S, P, u, i = self.S, self.S.P, self.u, self.i
        cat = S.cat
        keep = D["keep"][0]
        rows = []
        lat, lon = cat.lat, cat.lon
        last = [int(x) for x in P["last_items"][u]] if isinstance(P["last_items"][u], np.ndarray) else []
        t_u = int(P["t_ref"][u])
        pop_all = int(np.searchsorted(P["pop_keys"], i * (1 << 32) + t_u, "right") - np.searchsorted(P["pop_keys"], i * (1 << 32) - 1, "right"))
        pop_rec = int(np.searchsorted(P["pop_keys"], i * (1 << 32) + t_u, "right")
                      - np.searchsorted(P["pop_keys"], i * (1 << 32) + t_u - 180 * DAY, "right"))
        names = lambda ids: [str(S.places.iloc[j]["name"]) for j in ids]
        detail = {
            "gnn": dict(score=float(D["raw"]["gnn"][0, pos])),
            "near": dict(km=round(float(haversine(lat[i], lon[i], P["clat0"][u], P["clon0"][u])), 2),
                         radius_km=round(float(P["radius"][u]), 2)),
            "pop_all": dict(count=pop_all, before=_date(t_u)),
            "cat_match": dict(place=schemas._split(S.places.iloc[i]["categories"]),
                              user_top=[cat.cat_vocab[k] for k in np.argsort(-P["user_cat"][u])[:3] if P["user_cat"][u][k] > 0]),
            "price_diff": dict(place=None if np.isnan(cat.price[i]) else float(cat.price[i]),
                               user=None if np.isnan(P["user_price"][u]) else round(float(P["user_price"][u]), 2)),
            "item_rating": dict(stars10=round(float(cat.rating[i]) * 10, 1)),
            "item_reviews": dict(count=int(S.places.iloc[i]["review_count"] or 0)),
            "pop_recent": dict(count=pop_rec, days=180),
            "sim_last": dict(last=names(last)),
            "covisit": dict(count=int(round(np.expm1(float(D["raw"]["covisit"][0, pos])))), last=names(last)),
            "near_last": dict(km=round(float(-D["raw"]["near_last"][0, pos]), 2) if np.isfinite(D["raw"]["near_last"][0, pos]) else None,
                              last=names(last[-1:])),
            "asp_match": dict(place=[a["score"] for a in schemas.place_detail(S.places.iloc[i])["aspects"]]),
            "same_district": dict(district=schemas._nn(S.places.iloc[i]["district"])),
            "aud_match": dict(place=schemas._split(S.places.iloc[i]["target_audience"])),
        }
        for c in CRITERIA:
            raw = D["raw"][c][0]
            vals = raw[keep & np.isfinite(raw)]
            v = float(raw[pos]) if np.isfinite(raw[pos]) else None
            pct = float((vals < v).mean()) if v is not None and len(vals) else None
            rows.append(dict(key=c, label=CRIT_LABELS[c], group=GROUP[c], raw=None if v is None else round(v, 4),
                             z=round(float(D["z"][c][0, pos]), 4), percentile=None if pct is None else round(pct, 3),
                             dist=_v(np.sort(vals), 3), detail=detail[c]))
        return dict(real=real, n_cand=int(keep.sum()), criteria=rows)

    def step_lgbm(self, D, pos):
        X = feature_matrix(D)[0]
        b = self.e.booster
        keep = D["keep"][0]
        s_all = np.full(len(keep), -np.inf)
        s_all[keep] = b.predict(X[keep])
        contrib = b.predict(X[pos:pos + 1], pred_contrib=True)[0]
        feats = config.META["feats"]
        base = float(contrib[-1])
        by = {}
        for f, c in zip(feats, contrib[:-1]):
            k = f[2:] if f.startswith("z_") else f
            d = by.setdefault(k, dict(key=k, label=CRIT_LABELS[k], group=GROUP[k], raw=0.0, z=0.0))
            d["z" if f.startswith("z_") else "raw"] += float(c)
        items = sorted(by.values(), key=lambda d: -abs(d["raw"] + d["z"]))
        recomputed = base + sum(d["raw"] + d["z"] for d in items)
        for d in items:
            d["total"] = round(d["raw"] + d["z"], 5)
            d["raw"], d["z"] = round(d["raw"], 5), round(d["z"], 5)
        s = float(s_all[pos])
        return dict(base=round(base, 5), score=round(s, 5), contributions=items, n_trees=int(b.num_trees()),
                    check=_check(recomputed, s)), s_all

    def step_result(self, D, pos, real, s_all, stage1_rank):
        order = np.argsort(-s_all, kind="stable")
        rank = int(np.where(order == pos)[0][0]) + 1
        top = [int(D["cand"][0, j]) for j in order[:config.META["topk"]] if np.isfinite(s_all[j])]
        rec = [x.place_id for x in self.e.recommend(self.u, config.META["topk"]).items]
        engine_rank = rec.index(self.i) + 1 if self.i in rec else None
        top_names = [dict(id=j, name=str(self.S.places.iloc[j]["name"])) for j in top]
        return dict(rank=rank, in_topk=rank <= config.META["topk"], topk=config.META["topk"], stage1_rank=stage1_rank,
                    real=real, top=top_names, engine_rank=engine_rank,
                    check=_check(rank, engine_rank) if real and engine_rank is not None else None)

    def cold_steps(self):
        S = self.S
        row = S.users.iloc[self.u]
        prefs = json.loads(row["prefs"]) if isinstance(row["prefs"], str) else {}
        prefs = prefs or {}
        pop = cold._pct(np.log1p(S.pop_recent) + 0.25 * np.log1p(S.pop_all))
        c = S.cat
        cats = [c.cat_vocab.index(x) for x in prefs.get("categories") or [] if x in c.cat_vocab]
        dists = [c.districts.index(x) for x in prefs.get("districts") or [] if x in c.districts]
        prices = [int(p) for p in prefs.get("prices") or []]
        m_cat = bool(cats) and bool(np.asarray(c.attrs["IC"][self.i, cats].sum()) > 0)
        m_dist = bool(dists) and bool(c.d_dense[self.i, dists].sum() > 0)
        m_price = bool(prices) and (not np.isnan(c.price[self.i])) and int(c.price[self.i]) in prices
        s_all = cold.score(prefs, c, S.pop_recent, S.pop_all)
        s_all[c.hidden] = -np.inf
        total = float(s_all[self.i])
        rank = int((s_all > total).sum()) + 1
        recomputed = float(pop[self.i]) + 1.0 * m_cat + 0.5 * m_dist + 0.5 * m_price
        return dict(prefs=prefs, pop_recent=int(S.pop_recent[self.i]), pop_all=int(S.pop_all[self.i]),
                    recent_days=config.COLD_RECENT_DAYS, pop_pct=round(float(pop[self.i]), 4),
                    match=dict(category=m_cat, district=m_dist, price=m_price),
                    weights=dict(category=1.0, district=0.5, price=0.5), score=round(total, 4), rank=rank,
                    pool=int(np.isfinite(s_all).sum()), check=_check(recomputed, total))


def build(engine, user_id: int, place_id: int, q: str | None = None, model: str = "full") -> dict:
    """model = "full": mô hình chính (hai tầng, hoặc mô hình đơn giản nếu người dùng mới chưa có đánh giá).
    Khóa khác (pop, userknn, gnn_bin...): các bước của mô hình đó, xem trace_models."""
    from . import trace_models
    t = Tracer(engine, user_id, place_id)
    S = engine.state
    br = engine.branch(user_id)
    models = trace_models.model_list(engine, user_id)
    ok = {m["key"]: m["available"] for m in models}
    if not ok.get(model):
        raise ValueError(f"Mô hình {model} không xem được cho người dùng này")
    out = dict(user=dict(id=user_id, name=str(S.users.iloc[user_id]["name"])),
               place=dict(id=place_id, name=str(S.places.iloc[place_id]["name"])), branch=br,
               n_layers=config.N_LAYERS, rels=list(config.RELS), rel_labels=REL_LABELS, model=model, models=models)
    out["data"] = t.step_data()
    if q:
        f = schemas.fold(q)
        P = S.places
        m = (P["is_hidden"] == 0).to_numpy() & (P["name"].map(schemas.fold).str.contains(f, regex=False)
                                                 | P["address"].map(schemas.fold).str.contains(f, regex=False)).to_numpy()
        ids = np.where(m)[0]
        if model == "full":
            ids, _ = engine.search_order(user_id, ids)
        else:                                   # cùng cách xếp với /api/places?sort=personal&model=
            s = trace_models.get_comparer(engine).now_world().scores(model, [user_id])[0][ids]
            ids = ids[np.argsort(-s, kind="stable")]
        pos = np.where(ids == place_id)[0]
        out["search"] = dict(q=q, matched=int(len(ids)), rank=int(pos[0]) + 1 if len(pos) else None,
                             name_match=bool(f in schemas.fold(P.iloc[place_id]["name"])))
    if model != "full":
        out.update(trace_models.build(engine, user_id, place_id, model))
        return out
    if br == "nguoi_dung_moi_chua_co_lich_su":
        out["cold"] = t.cold_steps()
        return out
    out["nodes"] = t.step_nodes()
    out["weights"] = t.step_weights()
    out["norm"] = t.step_norm()
    out["e0"] = t.step_e0()
    out["layers"] = [t.layer(l) for l in range(1, config.N_LAYERS + 1)]
    out["stage1"] = t.step_stage1()
    D, pos, real = t.stage2()
    out["criteria"] = t.step_criteria(D, pos, real)
    out["lgbm"], s_all = t.step_lgbm(D, pos)
    out["result"] = t.step_result(D, pos, real, s_all, out["stage1"]["rank"])
    return out
