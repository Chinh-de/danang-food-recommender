"""Tạo lại data/foodgo.db từ dữ liệu đã xử lý và file crawl. uv run scripts/prepare_data.py"""
import json
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config, db


def nn(v):
    return None if pd.isna(v) else v


def main(path: Path | None = None):
    path = path or config.db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = db.connect(path)
    conn.executescript(db.SCHEMA)
    read = lambda n: pd.read_csv(config.SRC_PROCESSED / n, encoding="utf-8-sig")
    items, users, inter = read("items.csv").sort_values("i"), read("users.csv").sort_values("u"), read("interactions.csv")

    keep = set(items["place_id"])
    extra = {}
    with open(config.SRC_CRAWL / "places_final.jsonl", encoding="utf-8") as f:
        for line in f:
            p = json.loads(line)
            if p["place_id"] in keep:
                extra[p["place_id"]] = p
    rows = []
    for r in items.itertuples():
        e = extra.get(r.place_id, {})
        rows.append((r.i, r.place_id, r.name, nn(r.address), nn(r.district), r.latitude, r.longitude, nn(r.categories),
                     nn(r.price), e.get("price_min"), e.get("price_max"), nn(r.delivery), nn(r.stars), int(r.review_count),
                     nn(r.target_audience), nn(r.image_url), e.get("image_full_url"), nn(r.description), nn(r.opening),
                     e.get("phone"), nn(r.asp_0), nn(r.asp_1), nn(r.asp_2), nn(r.asp_3), nn(r.asp_4)))
    conn.executemany("insert into places(id, foody_id, name, address, district, lat, lon, categories, price, price_min, price_max,"
                     " delivery, stars, review_count, target_audience, image_url, image_full_url, description, opening, phone,"
                     " asp_0, asp_1, asp_2, asp_3, asp_4) values(" + ",".join("?" * 25) + ")", rows)

    n_rev = inter.groupby("u").size()
    conn.executemany("insert into users(id, foody_id, name, avatar, total_reviews) values(?,?,?,?,?)",
                     [(r.u, r.user_id, r.display_name if isinstance(r.display_name, str) else f"Người dùng {r.u}",
                       nn(r.avatar), int(n_rev.get(r.u, 0))) for r in users.itertuples()])

    pairs = set(zip(inter["user_id"], inter["place_id"]))
    texts = {}
    with open(config.SRC_CRAWL / "reviews_final.jsonl", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            k = (r.get("user_id"), r.get("place_id"))
            if k in pairs and k not in texts:
                texts[k] = (r.get("title"), r.get("text"), json.dumps(r.get("picture_urls") or []))
    rows = []
    for r in inter.itertuples():
        t = texts.get((r.user_id, r.place_id), (None, None, "[]"))
        rows.append((r.u, r.i, r.rating, int(r.ts), str(r.date).replace(" ", "T"), t[0], t[1], t[2], r.part))
    conn.executemany("insert into reviews(user_id, place_id, rating, ts, created_at, title, text, pictures, part)"
                     " values(?,?,?,?,?,?,?,?,?)", rows)
    conn.executemany("insert into settings values(?,?)", [("data_end_ts", str(int(inter["ts"].max()))),
                                                          ("db_created_real", str(time.time()))])
    conn.commit()
    print(f"Đã tạo {path}: {len(items)} quán, {len(users)} người dùng, {len(inter)} đánh giá, "
          f"{len(texts) / len(inter):.1%} đánh giá có nội dung từ file crawl")
    conn.close()


if __name__ == "__main__":
    main()
