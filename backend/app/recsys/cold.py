"""Mô hình đơn giản cho người dùng mới chưa có đánh giá: độ phổ biến + khớp sở thích đã chọn."""
import numpy as np


def _pct(x):
    """Phân vị trong [0, 1]: độ phổ biến đuôi dài không lấn át điểm khớp sở thích."""
    r = np.argsort(np.argsort(x, kind="stable"), kind="stable")
    return r / max(len(x) - 1, 1)


def score(prefs: dict | None, cat, pop_recent: np.ndarray, pop_all: np.ndarray) -> np.ndarray:
    s = _pct(np.log1p(pop_recent) + 0.25 * np.log1p(pop_all))
    prefs = prefs or {}
    cats = [cat.cat_vocab.index(c) for c in prefs.get("categories") or [] if c in cat.cat_vocab]
    dists = [cat.districts.index(d) for d in prefs.get("districts") or [] if d in cat.districts]
    prices = [int(p) for p in prefs.get("prices") or []]
    if cats:
        s = s + 1.0 * (np.asarray(cat.attrs["IC"][:, cats].sum(1)).ravel() > 0)
    if dists:
        s = s + 0.5 * (cat.d_dense[:, dists].sum(1) > 0)
    if prices:
        s = s + 0.5 * np.isin(np.nan_to_num(cat.price, nan=-1).astype(int), prices)
    return s
