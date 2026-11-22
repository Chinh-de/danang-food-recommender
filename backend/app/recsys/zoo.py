"""Các mô hình gợi ý để so sánh cơ chế (trang "So sánh mô hình").

Nhóm A: mô hình cổ điển, tính thẳng bằng NumPy/SciPy từ lịch sử đánh giá.
Nhóm B: các mô hình GNN của đề tài, dùng tham số đã huấn luyện trên Kaggle.

Mọi mô hình chạy trên một `World`: ảnh chụp dữ liệu tại một thời điểm
(hiện tại = toàn bộ đánh giá; quá khứ = train + valid, tập test bị ẩn).
"""
import csv

import lightgbm as lgb
import numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import svds

from .. import config
from .catalog import Catalog
from .features import build_phase, candidates, haversine, rank
from .graph import Layout, build_graph, inv_sqrt
from .loader import emb0
from .propagate import propagate

KNN = 50          # số láng giềng của User-kNN
SVD_DIM = 64      # số chiều PureSVD (bằng số chiều GNN)
MECH = ["interactions", "attributes", "rating", "time", "location", "local"]

MODELS = [
    # key, nhãn, nhóm, cơ chế dùng, mô tả ngắn
    ("pop", "Phổ biến", "A", [], "Quán nhiều đánh giá nhất, giống nhau với mọi người"),
    ("near", "Gần vùng quen", "A", ["location"], "Quán gần tâm các quán người dùng đã đến nhất"),
    ("content", "Dựa trên nội dung", "A", ["attributes", "rating"], "Hồ sơ thuộc tính (danh mục, giá, quận, đối tượng, khía cạnh) từ các quán đã đến"),
    ("userknn", "User-kNN", "A", ["interactions", "rating"], f"Lọc cộng tác: {KNN} người dùng giống nhất đã đến đâu"),
    ("itemknn", "Item-kNN", "A", ["interactions", "rating"], "Lọc cộng tác: quán giống các quán đã đến"),
    ("svd", "PureSVD", "A", ["interactions", "rating"], f"Phân rã ma trận người dùng–quán, {SVD_DIM} chiều"),
    ("gcn", "GCN", "B", ["interactions"], "Baseline: GNN trên đồ thị người dùng–quán, cạnh nhị phân"),
    ("gnn_bin", "Dị thể nhị phân", "B", ["interactions", "attributes", "local"], "Thêm nút thuộc tính, cạnh nhị phân"),
    ("gnn_rating", "Dị thể theo điểm", "B", ["interactions", "attributes", "local", "rating"], "Cạnh theo điểm đánh giá"),
    ("gnn_dyn", "Dị thể động", "B", ["interactions", "attributes", "local", "rating", "time"], "Cạnh theo điểm và độ mới (tầng 1)"),
    ("full", "Hai tầng", "B", ["interactions", "attributes", "local", "rating", "time", "location"], "Tầng 1 + xếp hạng lại 14 tiêu chí (mô hình đề xuất)"),
]
NOTEBOOK_ROWS = {"GCN": "gcn", "GNN dị thể (nhị phân)": "gnn_bin", "GNN dị thể (theo điểm)": "gnn_rating",
                 "GNN dị thể (động)": "gnn_dyn", "GNN dị thể + xếp hạng lại (tĩnh + động + tiêu chí đặc thù)": "full"}
GNN_FILES = {"gnn_bin": ("gnn_nhi_phan.npz", "binary"), "gnn_rating": ("gnn_theo_diem.npz", "static")}


def available(key: str) -> bool:
    if key == "gcn":
        return (config.ARTIFACTS / "gcn.npz").exists()
    if key in GNN_FILES:
        return (config.ARTIFACTS / GNN_FILES[key][0]).exists()
    return True


def _rownorm(M):
    n = np.sqrt(np.asarray(M.multiply(M).sum(1)).ravel())
    return sp.diags(np.where(n > 0, 1 / np.maximum(n, 1e-12), 0)) @ M


def _l2(M):
    return M / np.maximum(np.linalg.norm(M, axis=1, keepdims=True), 1e-12)


class World:
    def __init__(self, places, users, hist, cat=None, layout=None, P=None, main=None):
        self.places, self.users, self.hist = places, users, hist
        self.cat = cat or Catalog.from_places(places, config.META["I"])
        if layout is None:
            sizes = {k: self.cat.attrs[k].shape[1] for k in config.RELS[1:]}
            layout = Layout(config.META["U"], config.META["I"], sizes, len(users), len(places))
        self.layout = layout
        self.U, self.I = len(users), self.cat.n_items
        u, i = hist["u"].to_numpy(), hist["i"].to_numpy()
        self.R = sp.csr_matrix((hist["r"].to_numpy(float), (u, i)), shape=(self.U, self.I))
        self.seen = sp.csr_matrix((np.ones(len(hist)), (u, i)), shape=(self.U, self.I))
        self.P = P
        self._main = main
        self._cache = {}
        n = np.maximum(np.bincount(u, minlength=self.U), 1)
        self.clat = np.bincount(u, self.cat.lat[i], self.U) / n
        self.clon = np.bincount(u, self.cat.lon[i], self.U) / n
        self.pop = np.bincount(i, minlength=self.I).astype(float)

    def phase(self):
        if self.P is None:
            self.P = build_phase(self.hist, self.cat, self.U)
        return self.P

    # ---------- điểm của từng mô hình: (len(users), I) ----------
    def scores(self, key: str, users) -> np.ndarray:
        users = np.asarray(users)
        fn = getattr(self, f"_s_{key}")
        return fn(users)

    def _s_pop(self, users):
        return np.tile(self.pop, (len(users), 1))

    def _s_near(self, users):
        c = self.cat
        d = haversine(c.lat[None, :], c.lon[None, :], self.clat[users, None], self.clon[users, None])
        return -d + 1e-3 * c.rating[None, :]          # hòa thì quán điểm cao hơn

    def _content_F(self):
        if "F" not in self._cache:
            c = self.cat
            price = np.zeros((self.I, 4))
            ok = ~np.isnan(c.price)
            price[np.where(ok)[0], c.price[ok].astype(int) - 1] = 1
            blocks = [c.ic_dense, price, c.d_dense, c.a_dense, c.asp]
            self._cache["F"] = _l2(np.hstack([_l2(b.astype(float)) for b in blocks]))
        return self._cache["F"]

    def _s_content(self, users):
        F = self._content_F()
        prof = (self.R[users] @ F) / np.maximum(np.asarray(self.R[users].sum(1)), 1e-12)
        return _l2(prof) @ F.T

    def _s_userknn(self, users):
        if "Rn" not in self._cache:
            self._cache["Rn"] = _rownorm(self.R).tocsr()
        Rn = self._cache["Rn"]
        S = (Rn[users] @ Rn.T).toarray()
        S[np.arange(len(users)), users] = 0
        k = min(KNN, S.shape[1] - 1)
        idx = np.argpartition(-S, k - 1, axis=1)[:, :k]
        T = np.zeros_like(S)
        np.put_along_axis(T, idx, np.take_along_axis(S, idx, 1), 1)
        return np.asarray((self.R.T @ T.T).T)

    def _s_itemknn(self, users):
        if "Sii" not in self._cache:
            Cn = _rownorm(self.R.T.tocsr())
            S = (Cn @ Cn.T).toarray()
            np.fill_diagonal(S, 0)
            self._cache["Sii"] = S
        return np.asarray(self.R[users] @ self._cache["Sii"])

    def _s_svd(self, users):
        if "svd" not in self._cache:
            k = min(SVD_DIM, min(self.R.shape) - 1)
            Us, s, Vt = svds(self.R.astype(np.float64), k=k)
            self._cache["svd"] = (Us * s, Vt)
        A, Vt = self._cache["svd"]
        return A[users] @ Vt

    def _gnn(self, key):
        if key not in self._cache:
            if key == "gnn_dyn":
                if self._main is not None:
                    self._cache[key] = self._main
                else:
                    g = build_graph(self.hist, self.cat, self.layout, "dynamic")
                    self._cache[key] = propagate(emb0(), g, config.META["rel_weights"], self.layout)
            elif key == "gcn":
                self._cache[key] = self._gcn()
            else:
                f, mode = GNN_FILES[key]
                z = np.load(config.ARTIFACTS / f)
                logit = z["rel_logit"]
                a = np.exp(logit - logit.max())
                a = a / a.sum() * len(logit)
                g = build_graph(self.hist, self.cat, self.layout, mode)
                self._cache[key] = propagate(z["emb_weight"], g, dict(zip(config.RELS, a)), self.layout)
        return self._cache[key]

    def gcn_graph(self):
        """Â của GCN: đồ thị người dùng–quán cạnh nhị phân, thêm vòng tự thân, chuẩn hóa đối xứng."""
        if "gcn_A" not in self._cache:
            L = self.layout
            n = L.n_nodes
            u, i = self.hist["u"].to_numpy(), self.hist["i"].to_numpy()
            r, c = L.user_nodes[u], L.item_nodes[i]
            A = sp.coo_matrix((np.ones(2 * len(u)), (np.concatenate([r, c]), np.concatenate([c, r]))), shape=(n, n)).tocsr()
            A.data[:] = 1
            A = A + sp.identity(n, format="csr")
            d = sp.diags(inv_sqrt(np.asarray(A.sum(1)).ravel()))
            self._cache["gcn_A"] = (d @ A @ d).tocsr()
        return self._cache["gcn_A"]

    def gcn_layers(self):
        """Các lớp x⁽⁰⁾..x⁽ᴸ⁾ của GCN: x⁽ˡ⁾ = ReLU(Â x⁽ˡ⁻¹⁾ Wₗᵀ + bₗ), lớp cuối không ReLU."""
        if "gcn_layers" not in self._cache:
            z = load_gcn()
            L = self.layout
            Ah = self.gcn_graph()
            x = np.zeros((L.n_nodes, z["emb_weight"].shape[1]))
            x[:L.n0] = z["emb_weight"][:L.n0]
            xs = [x]
            nl = sum(1 for k in z if k.startswith("lins_") and k.endswith("_weight"))
            for l in range(nl):
                x = (Ah @ x) @ z[f"lins_{l}_weight"].T + z[f"lins_{l}_bias"]
                if l < nl - 1:
                    x = np.maximum(x, 0)
                xs.append(x)
            self._cache["gcn_layers"] = xs
        return self._cache["gcn_layers"]

    def _gcn(self):
        x = self.gcn_layers()[-1]
        L = self.layout
        return x[L.user_nodes].astype(np.float32), x[L.item_nodes].astype(np.float32)

    def _s_gcn(self, users):
        Eu, Ei = self._gnn("gcn")
        return Eu[users] @ Ei.T

    def _s_gnn_bin(self, users):
        Eu, Ei = self._gnn("gnn_bin")
        return Eu[users] @ Ei.T

    def _s_gnn_rating(self, users):
        Eu, Ei = self._gnn("gnn_rating")
        return Eu[users] @ Ei.T

    def _s_gnn_dyn(self, users):
        Eu, Ei = self._gnn("gnn_dyn")
        return Eu[users] @ Ei.T

    # ---------- top-K ----------
    def topk(self, key: str, users, k: int, booster=None) -> np.ndarray:
        """Top-K quán chưa đến, chưa ẩn; -1 ở ô trống. Mô hình hai tầng đi qua 200 ứng viên + LightGBM."""
        users = np.asarray(users)
        allow = ~self.cat.hidden
        if key == "full":
            Eu, Ei = self._gnn("gnn_dyn")
            D = candidates(self.phase(), Eu, Ei, users, self.cat, allow=allow)
            top, _, _ = rank(D, booster, k)
            return top
        S = self.scores(key, users).astype(float)
        ex = self.seen[users].tocoo()
        S[ex.row, ex.col] = -np.inf
        S[:, ~allow] = -np.inf
        kk = min(k, S.shape[1] - 1)
        idx = np.argpartition(-S, kk - 1, axis=1)[:, :kk]
        part = np.take_along_axis(S, idx, 1)
        order = np.argsort(-part, axis=1, kind="stable")
        top = np.take_along_axis(idx, order, 1)
        return np.where(np.isfinite(np.take_along_axis(part, order, 1)), top, -1)


def load_gcn() -> dict:
    z = np.load(config.ARTIFACTS / "gcn.npz")
    return {k: z[k] for k in z.files}


def notebook_results() -> dict:
    p = config.ARTIFACTS / "results.csv"
    if not p.exists():
        return {}
    out = {}
    with open(p, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = NOTEBOOK_ROWS.get(row["Phương pháp"])
            if key:
                out[key] = {k: float(v) for k, v in row.items() if "@" in k}
    return out


def load_booster():
    return lgb.Booster(model_file=str(config.ARTIFACTS / "ranker.txt"))
