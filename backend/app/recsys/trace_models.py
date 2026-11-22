"""Trực quan hóa từng bước cho các mô hình khác ngoài mô hình chính (nút chuyển mô hình trong popup).

Mỗi mô hình trả về số liệu của các bước riêng của nó, cộng một khối `ranking` chung: điểm của quán,
thứ hạng, top-K. Điểm được tính lại từ các thành phần rồi so với điểm mô hình dùng (_check),
thứ hạng lấy đúng từ `World.topk` như trang so sánh mô hình.
"""
import numpy as np

from .. import config
from .compare import META, get_comparer
from .features import haversine
from .graph import build_graph
from .propagate import propagate
from .trace import GnnView, Tracer, _check, _v, main_view
from .zoo import GNN_FILES, KNN, _l2, _rownorm, available, load_gcn

TOPK = config.META["topk"]
SHOW = 8                        # số dòng hiện trong các bảng
GNN_KEYS = ("gnn_bin", "gnn_rating", "gnn_dyn")
NEEDS_HISTORY = ("near", "content", "userknn", "itemknn", "svd", "gcn", "gnn_bin", "gnn_rating", "gnn_dyn")


def _name(W, j):
    return str(W.places.iloc[int(j)]["name"])


def model_list(engine, user_id: int) -> list[dict]:
    """Danh sách cho nút chuyển mô hình; người dùng chưa có đánh giá chỉ xem được Phổ biến và mô hình chính."""
    W = get_comparer(engine).now_world()
    has_hist = W.seen[user_id].nnz > 0
    out = []
    for k, m in META.items():
        ok, why = available(k), None
        if not ok:
            why = "chưa có tham số đã huấn luyện"
        elif k in NEEDS_HISTORY and not has_hist:
            ok, why = False, "người dùng chưa có đánh giá"
        out.append(dict(key=k, label=m["label"], group=m["group"], description=m["description"], available=ok, reason=why))
    return out


def ranking(W, key, u, i, s_row, check):
    """Thứ hạng của quán i trong các quán u chưa đến; top-K lấy từ World.topk (cùng kết quả trang so sánh)."""
    allow = ~W.cat.hidden
    seen = W.seen[u].indices
    pool = allow.copy()
    pool[seen] = False
    s = np.asarray(s_row, float)
    seen_flag = bool(i in set(seen.tolist()))
    top = [int(x) for x in W.topk(key, [u], TOPK)[0] if x >= 0]
    engine_rank = top.index(i) + 1 if i in top else None
    rank = engine_rank or (None if seen_flag else int((s[pool] > s[i]).sum()) + 1)
    ties = int((s[pool] == s[i]).sum()) - (0 if seen_flag or not pool[i] else 1)
    vals = s[pool & np.isfinite(s)]
    counts, edges = np.histogram(vals, bins=24)
    return dict(score=round(float(s[i]), 6), rank=rank, ties=max(ties, 0), pool=int(pool.sum()), seen=seen_flag,
                in_topk=engine_rank is not None, topk=TOPK, top=[dict(id=j, name=_name(W, j)) for j in top],
                hist=dict(counts=[int(c) for c in counts], edges=_v(edges, 4)), check=check)


# ---------------- nhóm A ----------------
def t_pop(W, u, i):
    s = W.scores("pop", [u])[0]
    cnt = int((W.hist["i"].to_numpy() == i).sum())
    allow = ~W.cat.hidden
    order = [j for j in np.argsort(-W.pop, kind="stable") if allow[j]][:5]
    d = dict(count=cnt, n_reviews=int(len(W.hist)), most=[dict(name=_name(W, j), count=int(W.pop[j])) for j in order])
    return d, s, _check(cnt, s[i])


def t_near(W, u, i):
    s = W.scores("near", [u])[0]
    c = W.cat
    js = W.hist.loc[W.hist["u"] == u, "i"].to_numpy()
    clat, clon = float(c.lat[js].mean()), float(c.lon[js].mean())
    km = float(haversine(c.lat[i], c.lon[i], clat, clon))
    bonus = 1e-3 * float(c.rating[i])
    uniq = list(dict.fromkeys(js.tolist()))[:30]
    pts = [dict(name=_name(W, j), lat=float(c.lat[j]), lon=float(c.lon[j])) for j in uniq]
    d = dict(points=pts, n_rows=int(len(js)), center=dict(lat=clat, lon=clon),
             place=dict(lat=float(c.lat[i]), lon=float(c.lon[i])), km=round(km, 4), bonus=round(bonus, 5),
             rating10=round(float(c.rating[i]) * 10, 1), check_center=_check([clat, clon], [W.clat[u], W.clon[u]]))
    return d, s, _check(-km + bonus, s[i])


def _content_blocks(W):
    c = W.cat
    price = np.zeros((W.I, 4))
    ok = ~np.isnan(c.price)
    price[np.where(ok)[0], c.price[ok].astype(int) - 1] = 1
    raw = [("Danh mục", c.ic_dense, list(c.cat_vocab)), ("Mức giá", price, [config.PRICE_LABELS[k] for k in range(1, 5)]),
           ("Quận", c.d_dense, list(c.districts)), ("Đối tượng khách", c.a_dense, list(c.audiences)),
           ("5 khía cạnh", c.asp, list(config.ASPECTS))]
    out, off = [], 0
    for name, M, labels in raw:
        out.append((name, slice(off, off + M.shape[1]), labels))
        off += M.shape[1]
    return out


def t_content(W, u, i):
    s = W.scores("content", [u])[0]
    F = W._content_F()
    row = W.R[u]
    js, r = row.indices, row.data
    prof = (r @ F[js]) / max(float(r.sum()), 1e-12)
    pn = prof / max(float(np.linalg.norm(prof)), 1e-12)
    blocks, total = [], 0.0
    for name, sl, labels in _content_blocks(W):
        fi, pu = F[i, sl], pn[sl]
        top_i = [dict(label=labels[k], value=round(float(fi[k]), 4)) for k in np.argsort(-np.abs(fi))[:4] if abs(fi[k]) > 1e-9]
        top_u = [dict(label=labels[k], value=round(float(pu[k]), 4)) for k in np.argsort(-np.abs(pu))[:4] if abs(pu[k]) > 1e-9]
        total += float(fi @ pu)
        blocks.append(dict(name=name, place=top_i, user=top_u, contrib=round(float(fi @ pu), 5)))
    hist = sorted(zip(js.tolist(), r.tolist()), key=lambda x: -x[1])[:SHOW]
    d = dict(blocks=blocks, history=[dict(name=_name(W, j), r=round(float(w), 3)) for j, w in hist], n_history=int(len(js)),
             dim=int(F.shape[1]))
    return d, s, _check(total, s[i])


def t_userknn(W, u, i):
    s = W.scores("userknn", [u])[0]
    Rn = W._cache["Rn"]
    sim = (Rn[[u]] @ Rn.T).toarray()[0]
    sim[u] = 0
    k = min(KNN, len(sim) - 1)
    idx = np.argpartition(-sim[None, :], k - 1, axis=1)[0, :k]
    idx = idx[np.argsort(-sim[idx], kind="stable")]
    col = W.R[:, i].toarray().ravel()
    mine = set(W.seen[u].indices.tolist())
    users = W.users["name"].to_numpy()
    neigh = [dict(name=str(users[v]), sim=round(float(sim[v]), 4), common=len(mine & set(W.seen[v].indices.tolist())),
                  r=round(float(col[v]), 3) if col[v] > 0 else None) for v in idx[:SHOW]]
    contrib = sorted([(v, float(sim[v]), float(col[v])) for v in idx if col[v] > 0], key=lambda x: -x[1] * x[2])
    d = dict(k=int(k), n_users=int(W.U), n_history=len(mine), neighbors=neigh, n_contrib=len(contrib),
             contributors=[dict(name=str(users[v]), sim=round(a, 4), r=round(b, 3), prod=round(a * b, 5)) for v, a, b in contrib[:SHOW]],
             rest=round(sum(a * b for _, a, b in contrib[SHOW:]), 5))
    return d, s, _check(sum(a * b for _, a, b in contrib), s[i])


def t_itemknn(W, u, i):
    s = W.scores("itemknn", [u])[0]
    Sii = W._cache["Sii"]
    row = W.R[u]
    seen_by = lambda j: set(W.R[:, j].indices.tolist())
    raters_i = seen_by(i)
    rows = [(int(j), float(r), float(Sii[j, i])) for j, r in zip(row.indices, row.data)]
    rows.sort(key=lambda x: -x[1] * x[2])
    d = dict(n_raters=len(raters_i), n_history=len(rows),
             rows=[dict(name=_name(W, j), r=round(r, 3), sim=round(sm, 4), prod=round(r * sm, 5), common=len(raters_i & seen_by(j)))
                   for j, r, sm in rows[:SHOW]],
             rest=round(sum(r * sm for _, r, sm in rows[SHOW:]), 5))
    return d, s, _check(sum(r * sm for _, r, sm in rows), s[i])


def t_svd(W, u, i):
    s = W.scores("svd", [u])[0]
    A, Vt = W._cache["svd"]
    a, v = A[u], Vt[:, i]
    prod = a * v
    order = np.argsort(-np.abs(prod))[:6]
    d = dict(shape=[int(W.U), int(W.I)], nnz=int(W.R.nnz), density=round(W.R.nnz / (W.U * W.I), 5), k=int(len(a)),
             n_history=int(W.seen[u].nnz), a=_v(a), v=_v(v), prod=_v(prod, 5),
             top=[dict(dim=int(k), a=round(float(a[k]), 4), v=round(float(v[k]), 4), prod=round(float(prod[k]), 5)) for k in order])
    return d, s, _check(float(prod.sum()), s[i])


# ---------------- GCN ----------------
def t_gcn(W, u, i):
    s = W.scores("gcn", [u])[0]
    xs, Ah, z = W.gcn_layers(), W.gcn_graph(), load_gcn()
    L = W.layout
    un, inode = int(L.user_nodes[u]), int(L.item_nodes[i])
    kind = {int(n): ("user", k) for k, n in enumerate(L.user_nodes)} | {int(n): ("place", k) for k, n in enumerate(L.item_nodes)}
    users = W.users["name"].to_numpy()
    label = lambda n: ("bản thân" if n in (un, inode) else str(users[kind[n][1]]) if kind[n][0] == "user" else _name(W, kind[n][1]))
    layers = []
    for l in range(1, len(xs)):
        Wl, bl = z[f"lins_{l - 1}_weight"], z[f"lins_{l - 1}_bias"]
        last = l == len(xs) - 1
        side = {}
        for who, v in (("place", inode), ("user", un)):
            row = Ah[v]
            js, a = row.indices, row.data
            contrib = a[:, None] * xs[l - 1][js]
            norms = np.linalg.norm(contrib, axis=1)
            agg = contrib.sum(0)
            lin = agg @ Wl.T + bl
            out = lin if last else np.maximum(lin, 0)
            side[who] = dict(n=int(row.nnz), neighbors=[dict(label=label(int(js[k])), a_hat=round(float(a[k]), 5), norm=round(float(norms[k]), 4))
                                                        for k in np.argsort(-norms)[:5]],
                             agg=_v(agg), lin=_v(lin), out=_v(out), relu=not last, n_zero=int((out == 0).sum()),
                             check=_check(out, xs[l][v]))
        layers.append(dict(l=l, **side))
    y = float(xs[-1][un] @ xs[-1][inode])
    d = dict(e0=dict(user=_v(xs[0][un]), place=_v(xs[0][inode])), layers=layers, y=round(y, 6),
             e_user=_v(xs[-1][un]), e_place=_v(xs[-1][inode]), n_nodes=int(L.n_nodes))
    return d, s, _check(y, s[i])


# ---------------- GNN dị thể ----------------
def gnn_view(engine, W, key) -> GnnView:
    if key == "gnn_dyn":
        return main_view(engine)
    ck = f"view_{key}"
    if ck not in W._cache:
        f, mode = GNN_FILES[key]
        z = np.load(config.ARTIFACTS / f)
        logit = z["rel_logit"]
        a = np.exp(logit - logit.max())
        alpha = dict(zip(config.RELS, (a / a.sum() * len(logit)).tolist()))
        g = build_graph(W.hist, W.cat, W.layout, mode)
        Eu, Ei, layers = propagate(z["emb_weight"], g, alpha, W.layout, return_layers=True)
        W._cache[ck] = GnnView(mode, g, layers, Eu, Ei, alpha)
        W._cache[key] = (Eu, Ei)             # World.topk dùng chung đúng embedding này
    return W._cache[ck]


CLASSIC = {"pop": t_pop, "near": t_near, "content": t_content, "userknn": t_userknn, "itemknn": t_itemknn, "svd": t_svd,
           "gcn": t_gcn}


def build(engine, user_id: int, place_id: int, key: str) -> dict:
    W = get_comparer(engine).now_world()
    if key in GNN_KEYS:
        v = gnn_view(engine, W, key)
        t = Tracer(engine, user_id, place_id, v)
        out = dict(nodes=t.step_nodes(), weights=t.step_weights(), norm=t.step_norm(), e0=t.step_e0(),
                   layers=[t.layer(l) for l in range(1, config.N_LAYERS + 1)], stage1=t.step_stage1(),
                   alpha=v.alpha)
        s = v.Eu[user_id] @ v.Ei.T
        out["ranking"] = ranking(W, key, user_id, place_id, s, out["stage1"]["check_y"])
        return out
    d, s, check = CLASSIC[key](W, user_id, place_id)
    return dict(classic=d, ranking=ranking(W, key, user_id, place_id, s, check))
