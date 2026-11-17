"""Trọng số cạnh và đồ thị dị thể (chuyển từ ô 12 của notebook).

Chỉ số nút của mô hình giữ nguyên: [người dùng | quán | IC | IP | IF | ID | IA]; người dùng mới rồi quán mới nối tiếp sau.
"""
import numpy as np
import pandas as pd
import scipy.sparse as sp

from .. import config


def ui_weight(hist: pd.DataFrame, mode: str) -> np.ndarray:
    if mode == "binary":
        return np.ones(len(hist), np.float32)
    r = hist["r"].to_numpy(float)
    if mode == "static":
        return r.astype(np.float32)
    t_ref = hist.groupby("u")["ts"].transform("max").to_numpy()
    dt_days = (t_ref - hist["ts"].to_numpy()) / 86400
    return (r * (config.W_FLOOR + (1 - config.W_FLOOR) * np.exp(-dt_days / config.TAU_DAYS))).astype(np.float32)


def inv_sqrt(d):
    out = np.zeros_like(d, dtype=np.float64)
    out[d > 0] = d[d > 0] ** -0.5
    return out


def norm_bipartite(B):
    return sp.diags(inv_sqrt(np.asarray(B.sum(1)).ravel())) @ B @ sp.diags(inv_sqrt(np.asarray(B.sum(0)).ravel()))


class Layout:
    def __init__(self, u_model: int, i_model: int, attr_sizes: dict, n_users: int, n_items: int):
        self.u_model, self.i_model, self.n_users, self.n_items = u_model, i_model, n_users, n_items
        self.off, n = {}, u_model + i_model
        for k in config.RELS[1:]:
            self.off[k] = n
            n += attr_sizes[k]
        self.n0 = n
        nu_new = n_users - u_model
        u = np.arange(n_users)
        i = np.arange(n_items)
        self.user_nodes = np.where(u < u_model, u, self.n0 + (u - u_model))
        self.item_nodes = np.where(i < i_model, u_model + i, self.n0 + nu_new + (i - i_model))
        self.n_nodes = self.n0 + nu_new + (n_items - i_model)
        self.new_mask = np.zeros(self.n_nodes, bool)
        self.new_mask[self.n0:] = True

    def user_node(self, u):
        return self.user_nodes[u]

    def item_node(self, i):
        return self.item_nodes[i]


def _place(B, rows, cols, n):
    B = B.tocoo()
    r, c = rows[B.row], cols[B.col]
    return sp.coo_matrix((np.concatenate([B.data, B.data]), (np.concatenate([r, c]), np.concatenate([c, r]))),
                         shape=(n, n)).tocsr()


def build_graph(hist: pd.DataFrame, cat, layout: Layout, ui: str = "dynamic") -> dict:
    B = sp.csr_matrix((ui_weight(hist, ui), (hist["u"].to_numpy(), hist["i"].to_numpy())),
                      shape=(layout.n_users, layout.n_items))
    g = {"UI": _place(norm_bipartite(B), layout.user_nodes, layout.item_nodes, layout.n_nodes)}
    for k in config.RELS[1:]:
        M = cat.attrs[k]
        g[k] = _place(norm_bipartite(M), layout.item_nodes, layout.off[k] + np.arange(M.shape[1]), layout.n_nodes)
    return g
