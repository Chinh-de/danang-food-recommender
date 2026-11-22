"""Đọc DB thành DataFrame và chạy tầng 1 (dùng chung cho Engine, script kiểm tra và test)."""
import numpy as np
import pandas as pd

from .. import config
from .catalog import Catalog
from .graph import Layout, build_graph
from .propagate import propagate

_EMB0 = None


def emb0() -> np.ndarray:
    global _EMB0
    if _EMB0 is None:
        _EMB0 = np.load(config.ARTIFACTS / "gnn.npz")["emb"]
    return _EMB0


def load_frames(conn, parts=None):
    places = pd.read_sql("select * from places order by id", conn)
    users = pd.read_sql("select * from users order by id", conn)
    q = "select user_id as u, place_id as i, rating, ts, part from reviews"
    hist = pd.read_sql(q, conn)
    if parts is not None:
        hist = hist[hist["part"].isin(parts)]
    hist = hist.assign(r=hist["rating"] / 10).reset_index(drop=True)
    return places, users, hist


def embed(places, users, hist, keep: bool = False):
    """keep=True: trả thêm (g, layers) để engine giữ lại cho trực quan hóa từng bước."""
    cat = Catalog.from_places(places, config.META["I"])
    sizes = {k: cat.attrs[k].shape[1] for k in config.RELS[1:]}
    layout = Layout(config.META["U"], config.META["I"], sizes, len(users), len(places))
    g = build_graph(hist, cat, layout, "dynamic")
    if keep:
        Eu, Ei, layers = propagate(emb0(), g, config.META["rel_weights"], layout, return_layers=True)
        return cat, layout, Eu, Ei, g, layers
    Eu, Ei = propagate(emb0(), g, config.META["rel_weights"], layout)
    return cat, layout, Eu, Ei
