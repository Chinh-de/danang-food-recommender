"""Đường dẫn và hằng số của mô hình (giữ nguyên theo notebook huấn luyện)."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]            # foodgo/
PROJECT = ROOT.parent                                  # thư mục dự án (chỉ đọc)
ARTIFACTS = ROOT / "artifacts"
SRC_MODEL = PROJECT / "notebooks" / "ket_qua_chay"
SRC_PROCESSED = PROJECT / "data" / "foody_processed"
SRC_CRAWL = PROJECT / "foody"


def db_path() -> Path:
    return Path(os.environ.get("FOODGO_DB") or ROOT / "data" / "foodgo.db")


def _meta() -> dict:
    p = ARTIFACTS / "train_meta.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


META = _meta()
TAU_DAYS, W_FLOOR = 180, 0.2
N_LAYERS, EMB_DIM = 3, 64
N_CAND, LAST_N, RECENT_N, RADIUS_Q = 200, 3, 20, 0.95
RELS = ["UI", "IC", "IP", "IF", "ID", "IA"]
ASPECTS = ["Chất lượng", "Phục vụ", "Vị trí", "Giá cả", "Không gian"]
PRICE_LABELS = {1: "Dưới 50.000đ", 2: "50.000-150.000đ", 3: "150.000-300.000đ", 4: "Trên 300.000đ"}
REVISIT_MIN_RATING = 7.0
COLD_RECENT_DAYS = 365   # dữ liệu Foody thưa dần từ giữa 2023: 180 ngày cuối chỉ có 4 đánh giá
