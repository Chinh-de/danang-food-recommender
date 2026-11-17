"""Lan truyền GNN dị thể bằng SciPy với tham số đã huấn luyện (HeteroGCN.forward ở ô 18)."""
import numpy as np

from .. import config


def propagate(emb0: np.ndarray, g: dict, alpha: dict, layout, n_layers: int = config.N_LAYERS):
    x = np.zeros((layout.n_nodes, emb0.shape[1]), np.float64)
    x[:layout.n0] = emb0[:layout.n0]
    total = x.copy()
    for _ in range(n_layers):
        x = sum(alpha[r] * (g[r] @ x) for r in config.RELS)
        total += x
    E = total / (n_layers + 1)
    # nút mới không có vector tầng 0: lấy trung bình trên các tầng 1..L để độ lớn so được với nút cũ
    E[layout.new_mask] = total[layout.new_mask] / n_layers
    E = E.astype(np.float32)
    return E[layout.user_nodes], E[layout.item_nodes]
