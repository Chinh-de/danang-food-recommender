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
for f in ["ranker.txt", "train_meta.json", "user_emb.npy", "item_emb.npy", "results.csv"]:
    shutil.copy2(config.SRC_MODEL / f, config.ARTIFACTS / f)
sd = torch.load(config.SRC_MODEL / "gnn_di_the.pt", map_location="cpu")
emb = sd["emb.weight"].numpy().astype(np.float32)
np.savez(config.ARTIFACTS / "gnn.npz", emb=emb, rel_logit=sd["rel_logit"].numpy())
print("emb", emb.shape, "| các khóa:", list(sd))

# Các biến thể để so sánh (trang "So sánh mô hình"); gcn.pt chỉ có sau khi chạy lại notebook với ô lưu GCN.
for src, dst in [("gnn_nhi_phan.pt", "gnn_nhi_phan.npz"), ("gnn_theo_diem.pt", "gnn_theo_diem.npz"), ("gcn.pt", "gcn.npz")]:
    p = config.SRC_MODEL / src
    if not p.exists():
        print("bỏ qua (chưa có):", src)
        continue
    sd = {k: v.numpy() for k, v in torch.load(p, map_location="cpu").items()}
    np.savez(config.ARTIFACTS / dst, **{k.replace(".", "_"): v for k, v in sd.items()})
    print(dst, {k: v.shape for k, v in sd.items()})

# GCN không được lưu ở lần chạy chính; gcn.pt lấy từ một lần chạy lại cùng mã và cấu hình (notebooks/foody_huan_luyen_chay_lai_gcn.ipynb).
# Dòng GCN của results.csv lấy theo lần chạy lại đó để trang so sánh đối chiếu đúng tham số đang dùng.
rerun = config.SRC_MODEL / "results_chay_lai_gcn.csv"
if rerun.exists() and (config.ARTIFACTS / "gcn.npz").exists():
    import csv
    def rows(p):
        with open(p, encoding="utf-8") as f:
            return list(csv.reader(f))
    main, again = rows(config.ARTIFACTS / "results.csv"), rows(rerun)
    gcn = next(r for r in again if r[0] == "GCN")
    main = [gcn if r[0] == "GCN" else r for r in main]
    with open(config.ARTIFACTS / "results.csv", "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(main)
    print("results.csv: dòng GCN lấy từ lần chạy lại", rerun.name)
