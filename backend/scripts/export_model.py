"""Chạy một lần: copy file mô hình và xuất tham số GNN sang .npz (cần torch).
uv run --with torch --extra-index-url https://download.pytorch.org/whl/cpu scripts/export_model.py"""
import shutil
import sys
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config

config.ARTIFACTS.mkdir(parents=True, exist_ok=True)
for f in ["ranker.txt", "train_meta.json", "user_emb.npy", "item_emb.npy"]:
    shutil.copy2(config.SRC_MODEL / f, config.ARTIFACTS / f)
sd = torch.load(config.SRC_MODEL / "gnn_di_the.pt", map_location="cpu")
emb = sd["emb.weight"].numpy().astype(np.float32)
np.savez(config.ARTIFACTS / "gnn.npz", emb=emb, rel_logit=sd["rel_logit"].numpy())
print("emb", emb.shape, "| các khóa:", list(sd))
