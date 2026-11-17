"""Ma trận thuộc tính và mảng metadata của quán, theo đúng cách notebook dựng (ô 10, 12, 15, 21)."""
from dataclasses import dataclass

import numpy as np
import pandas as pd
import scipy.sparse as sp

from .. import config


def _split(v, sep):
    if not isinstance(v, str):
        return []
    return [x.strip() for x in (v.split(sep) if sep else [v]) if x.strip()]


def _multi_hot(lists, vocab) -> sp.csr_matrix:
    idx = {x: k for k, x in enumerate(vocab)}
    pairs = [(i, idx[x]) for i, l in enumerate(lists) for x in set(l) if x in idx]
    pairs = np.array(pairs, dtype=np.int64).reshape(-1, 2)
    return sp.csr_matrix((np.ones(len(pairs), np.float32), (pairs[:, 0], pairs[:, 1])), shape=(len(lists), len(vocab)))


def _l2rows(M):
    return M / np.maximum(np.linalg.norm(M, axis=1, keepdims=True), 1e-8)


@dataclass
class Catalog:
    n_items: int
    i_model: int
    lat: np.ndarray
    lon: np.ndarray
    price: np.ndarray
    rating: np.ndarray
    reviews: np.ndarray
    hidden: np.ndarray
    is_new: np.ndarray
    attrs: dict
    ic_dense: np.ndarray
    asp: np.ndarray
    d_dense: np.ndarray
    a_dense: np.ndarray
    cat_vocab: list
    districts: list
    audiences: list

    @staticmethod
    def from_places(places: pd.DataFrame, i_model: int) -> "Catalog":
        places = places.sort_values("id").reset_index(drop=True)
        n = len(places)
        cat_vocab = list(config.META["cat_vocab"])
        cats = [_split(v, ", ") for v in places["categories"]]
        dists = [_split(v, None) for v in places["district"]]
        auds = [_split(v, ", ") for v in places["target_audience"]]
        districts = sorted({x for l in dists[:i_model] for x in l})
        audiences = sorted({x for l in auds[:i_model] for x in l})
        IC = _multi_hot(cats, cat_vocab)
        price = pd.to_numeric(places["price"], errors="coerce").to_numpy(float)
        ok = ~np.isnan(price)
        IP = sp.csr_matrix((np.ones(ok.sum(), np.float32), (np.where(ok)[0], price[ok].astype(int) - 1)), shape=(n, 4))
        dl = pd.to_numeric(places["delivery"], errors="coerce").to_numpy(float) == 1
        IF = sp.csr_matrix((np.ones(dl.sum(), np.float32), (np.where(dl)[0], np.zeros(dl.sum(), int))), shape=(n, 2))
        ID, IA = _multi_hot(dists, districts), _multi_hot(auds, audiences)

        stars = pd.to_numeric(places["stars"], errors="coerce").to_numpy(float)
        model_mean = np.nanmean(stars[:i_model])
        stars = np.where(np.isnan(stars), model_mean, stars)          # quán mới chưa có đánh giá: điểm trung bình hệ thống
        asp = places[[f"asp_{k}" for k in range(5)]].apply(pd.to_numeric, errors="coerce").to_numpy(float)
        asp = np.nan_to_num(asp - np.nanmean(asp[:i_model], 0))
        return Catalog(
            n_items=n, i_model=i_model,
            lat=places["lat"].to_numpy(float), lon=places["lon"].to_numpy(float), price=price,
            rating=stars / 5, reviews=np.log1p(places["review_count"].fillna(0).to_numpy(float)),
            hidden=places["is_hidden"].fillna(0).to_numpy(int) == 1, is_new=places["is_new"].fillna(0).to_numpy(int) == 1,
            attrs={"IC": IC, "IP": IP, "IF": IF, "ID": ID, "IA": IA},
            ic_dense=_l2rows(IC.toarray()), asp=asp, d_dense=ID.toarray(), a_dense=IA.toarray(),
            cat_vocab=cat_vocab, districts=districts, audiences=audiences,
        )
