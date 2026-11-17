"""Tiêu chí tầng 2 và xếp hạng lại LightGBM (chuyển từ ô 10, 15, 21 của notebook)."""
import numpy as np
import pandas as pd
import scipy.sparse as sp

from .. import config

SHIFT = 1 << 32
DAY = 86400


def haversine(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(a))


def count_before(keys_sorted, ids, t_hi, t_lo):
    base = np.asarray(ids).astype(np.int64) * SHIFT
    return np.searchsorted(keys_sorted, base + t_hi, "right") - np.searchsorted(keys_sorted, base + t_lo, "right")


def covisit_keys(hist, n_items, window=config.LAST_N):
    h = hist.sort_values(["u", "ts"], kind="stable")
    u, i, ts = h["u"].to_numpy(), h["i"].to_numpy(np.int64), h["ts"].to_numpy(np.int64)
    pa, tb = [], []
    for k in range(1, window + 1):
        same = u[k:] == u[:-k]
        pa.append(i[:-k][same] * n_items + i[k:][same])
        tb.append(ts[k:][same])
    return np.sort(np.concatenate(pa) * SHIFT + np.concatenate(tb))


def zrow(x):
    x = np.where(np.isfinite(x), x, np.nan)
    with np.errstate(invalid="ignore"):
        return np.nan_to_num((x - np.nanmean(x, 1, keepdims=True)) / (np.nanstd(x, 1, keepdims=True) + 1e-8))


def _cosine_rows(prof, M, cand):
    a = prof / np.maximum(np.linalg.norm(prof, axis=1, keepdims=True), 1e-8)
    b = M[cand] / np.maximum(np.linalg.norm(M[cand], axis=2, keepdims=True), 1e-8)
    return np.einsum("ud,ucd->uc", a, b)


def build_phase(hist: pd.DataFrame, cat, n_users: int) -> dict:
    """make_phase của notebook (không có đích). hist có cột u, i, r, ts."""
    U, I = n_users, cat.n_items
    lat, lon = cat.lat, cat.lon
    H = sp.csr_matrix((np.ones(len(hist), np.float32), (hist["u"].to_numpy(), hist["i"].to_numpy())), shape=(U, I))
    P = dict(hist=hist, excl=H)
    h = hist.sort_values(["u", "ts"], kind="stable")
    u, i, ts = h["u"].to_numpy(), h["i"].to_numpy(), h["ts"].to_numpy()
    w = np.exp(-(h.groupby("u")["ts"].transform("max").to_numpy() - ts) / (config.TAU_DAYS * DAY))
    W = np.bincount(u, w, U)
    P["clat"] = np.bincount(u, w * lat[i], U) / np.maximum(W, 1e-12)
    P["clon"] = np.bincount(u, w * lon[i], U) / np.maximum(W, 1e-12)
    d = haversine(lat[i], lon[i], P["clat"][u], P["clon"][u])
    recent = (h.groupby("u").cumcount(ascending=False) < config.RECENT_N).to_numpy()
    rq = pd.Series(d[recent]).groupby(u[recent]).quantile(config.RADIUS_Q)
    r_personal = np.zeros(U)
    r_personal[rq.index.to_numpy()] = rq.to_numpy()
    P["radius"] = np.maximum(config.META["r_global_km"], r_personal)
    P["t_ref"] = h.groupby("u")["ts"].max().reindex(range(U)).to_numpy()
    n_u = np.maximum(np.bincount(u, minlength=U), 1)
    P["clat0"], P["clon0"] = np.bincount(u, lat[i], U) / n_u, np.bincount(u, lon[i], U) / n_u
    tail = h.groupby("u").tail(config.LAST_N)
    P["last_items"] = tail.groupby("u")["i"].apply(np.array).reindex(range(U)).to_numpy()
    last1 = h.groupby("u")["i"].last().reindex(range(U)).to_numpy()
    has = ~pd.isna(last1)
    l1 = np.where(has, last1, 0).astype(int)
    P["last_lat"], P["last_lon"] = np.where(has, lat[l1], np.nan), np.where(has, lon[l1], np.nan)
    P["hist_len"] = np.bincount(u, minlength=U)
    uc = (H @ cat.attrs["IC"]).toarray()
    P["user_cat"] = uc / np.maximum(np.linalg.norm(uc, axis=1, keepdims=True), 1e-8)
    hp = cat.price[i]
    ok = ~np.isnan(hp)
    cnt = np.bincount(u[ok], minlength=U)
    with np.errstate(invalid="ignore"):
        P["user_price"] = np.where(cnt > 0, np.bincount(u[ok], hp[ok], U) / np.maximum(cnt, 1), np.nan)
    nh = np.maximum(np.asarray(H.sum(1)), 1)
    P["prof_asp"] = (H @ cat.asp) / nh
    P["prof_dist"] = (H @ cat.d_dense) / nh
    P["prof_aud"] = (H @ cat.a_dense) / nh
    P["pop_keys"] = np.sort(hist["i"].to_numpy(np.int64) * SHIFT + hist["ts"].to_numpy(np.int64))
    P["cov_keys"] = covisit_keys(hist, I)
    return P


def top_candidates(P, Eu, Ei, users, n_cand, allow=None):
    S = (Eu[users] @ Ei.T).astype(np.float32)
    ex = P["excl"][users].tocoo()
    S[ex.row, ex.col] = -np.inf
    if allow is not None:
        S[:, ~allow] = -np.inf
    k = min(n_cand, S.shape[1] - 1)
    idx = np.argpartition(-S, k - 1, axis=1)[:, :k]
    part = np.take_along_axis(S, idx, 1)
    order = np.argsort(-part, axis=1, kind="stable")
    return np.take_along_axis(idx, order, 1), np.take_along_axis(part, order, 1)


def candidates(P, Eu, Ei, users, cat, n_cand=config.N_CAND, allow=None) -> dict:
    """stage của notebook: 200 ứng viên tầng 1 và 14 tiêu chí."""
    I = cat.n_items
    users = np.asarray(users)
    cand, score = top_candidates(P, Eu, Ei, users, n_cand, allow)
    keep = np.isfinite(score)
    t_u = P["t_ref"][users][:, None].astype(np.int64)
    cov = np.zeros(cand.shape)
    for r, u in enumerate(users):
        for a in P["last_items"][u]:
            cov[r] += count_before(P["cov_keys"], int(a) * I + cand[r], t_u[r, 0], -1)
    Ein = Ei / np.maximum(np.linalg.norm(Ei, axis=1, keepdims=True), 1e-12)
    last_vec = np.stack([Ein[P["last_items"][u]].mean(0) for u in users])
    lat, lon = cat.lat, cat.lon
    raw = {
        "gnn": score.astype(float),
        "near": -haversine(lat[cand], lon[cand], P["clat0"][users, None], P["clon0"][users, None])
                / np.maximum(P["radius"][users, None], 1e-6),
        "pop_all": np.log1p(count_before(P["pop_keys"], cand, t_u, -1)),
        "cat_match": np.stack([cat.ic_dense[cand[r]] @ P["user_cat"][u] for r, u in enumerate(users)]),
        "price_diff": -np.abs(cat.price[cand] - P["user_price"][users, None]),
        "item_rating": cat.rating[cand], "item_reviews": cat.reviews[cand],
        "pop_recent": np.log1p(count_before(P["pop_keys"], cand, t_u, t_u - 180 * DAY)),
        "sim_last": np.einsum("ud,ucd->uc", last_vec, Ein[cand]),
        "covisit": np.log1p(cov),
        "near_last": -haversine(lat[cand], lon[cand], P["last_lat"][users, None], P["last_lon"][users, None]),
        "asp_match": _cosine_rows(P["prof_asp"][users], cat.asp, cand),
        "same_district": np.einsum("ud,ucd->uc", P["prof_dist"][users], cat.d_dense[cand]),
        "aud_match": _cosine_rows(P["prof_aud"][users], cat.a_dense, cand),
    }
    return dict(users=users, cand=cand, keep=keep, raw=raw,
                z={k: zrow(np.where(keep, v, np.nan)) for k, v in raw.items()})


def feature_matrix(D) -> np.ndarray:
    cols = [D["z"][f[2:]] if f.startswith("z_") else np.nan_to_num(D["raw"][f]) for f in config.META["feats"]]
    return np.stack(cols, -1)


def rank(D, booster, k: int):
    """Chấm 200 ứng viên bằng LightGBM; trả (top [n, k], score [n, k], vị trí trong cand [n, k]), -1 ở ô trống."""
    X = feature_matrix(D)
    s = np.full(D["keep"].shape, -np.inf)
    if D["keep"].any():
        s[D["keep"]] = booster.predict(X[D["keep"]])
    pos = np.argsort(-s, axis=1, kind="stable")[:, :k]
    sc = np.take_along_axis(s, pos, 1)
    ok = np.isfinite(sc)
    top = np.where(ok, np.take_along_axis(D["cand"], pos, 1), -1)
    return top, np.where(ok, sc, np.nan), np.where(ok, pos, -1)
