"""So khớp đường gợi ý của backend với notebook: lịch sử = train + valid, đích = test. uv run scripts/check_notebook.py"""
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config, db
from app.recsys.features import build_phase, candidates, rank
from app.recsys.loader import embed, load_frames

KS = (10, 20, 50)
DISC = 1 / np.log2(np.arange(2, max(KS) + 2))


def evaluate(top, users, target_keys, n_target, I):
    valid = top >= 0
    safe = np.where(valid, top, 0)
    rel = np.isin(users[:, None].astype(np.int64) * I + safe, target_keys) & valid
    nt = n_target[users]
    first = np.where(rel.any(1), rel.argmax(1) + 1, np.inf)
    out = {}
    for k in KS:
        r = rel[:, :k]
        idcg = np.cumsum(DISC[:k])[np.minimum(nt, k) - 1]
        out[f"Recall@{k}"] = (r.sum(1) / nt).mean()
        out[f"NDCG@{k}"] = ((r * DISC[:k]).sum(1) / idcg).mean()
        out[f"HitRate@{k}"] = r.any(1).mean()
        out[f"MRR@{k}"] = np.where(first <= k, 1 / first, 0).mean()
    return out


def run_check(conn) -> dict:
    places, users, all_hist = load_frames(conn)
    hist = all_hist[all_hist["part"].isin(["train", "valid"])].reset_index(drop=True)
    test = all_hist[all_hist["part"] == "test"]
    cat, layout, Eu, Ei = embed(places, users, hist)
    P = build_phase(hist, cat, len(users))
    I = cat.n_items
    tusers = np.unique(test["u"].to_numpy())
    D = candidates(P, Eu, Ei, tusers, cat)
    booster = lgb.Booster(model_file=str(config.ARTIFACTS / "ranker.txt"))
    top, _, _ = rank(D, booster, max(KS))
    keys = np.unique(test["u"].to_numpy(np.int64) * I + test["i"].to_numpy(np.int64))
    return evaluate(top, tusers, keys, np.bincount(test["u"], minlength=len(users)), I)


if __name__ == "__main__":
    m = run_check(db.connect())
    for k in KS:
        print(f"K={k}: " + "  ".join(f"{n}={m[f'{n}@{k}']:.4f}" for n in ["Recall", "NDCG", "HitRate", "MRR"]))
