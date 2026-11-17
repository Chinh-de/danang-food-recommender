"""SQLite: lược đồ và các hàm ghi."""
import json
import sqlite3
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE users(id INTEGER PRIMARY KEY, foody_id INTEGER, name TEXT NOT NULL, avatar TEXT,
  total_reviews INTEGER DEFAULT 0, is_new INTEGER DEFAULT 0, prefs TEXT);
CREATE TABLE places(id INTEGER PRIMARY KEY, foody_id INTEGER, name TEXT NOT NULL, address TEXT, district TEXT,
  lat REAL, lon REAL, categories TEXT, price REAL, price_min REAL, price_max REAL, delivery REAL,
  stars REAL, review_count INTEGER, target_audience TEXT, image_url TEXT, image_full_url TEXT,
  description TEXT, opening TEXT, phone TEXT, asp_0 REAL, asp_1 REAL, asp_2 REAL, asp_3 REAL, asp_4 REAL,
  is_new INTEGER DEFAULT 0, is_hidden INTEGER DEFAULT 0);
CREATE TABLE reviews(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, place_id INTEGER NOT NULL,
  rating REAL NOT NULL, ts INTEGER NOT NULL, created_at TEXT NOT NULL, title TEXT, text TEXT, pictures TEXT,
  part TEXT, is_new INTEGER DEFAULT 0, UNIQUE(user_id, place_id));
CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX idx_reviews_place ON reviews(place_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
"""

PLACE_FIELDS = ["name", "address", "district", "lat", "lon", "categories", "price", "price_min", "price_max", "delivery",
                "target_audience", "image_url", "image_full_url", "description", "opening", "phone", "is_hidden"]


def connect(path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path or config.db_path()), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def upsert_review(conn, user_id, place_id, rating, title, text, ts, created_at) -> int:
    """Ghi đánh giá; nếu cặp (người dùng, quán) đã có thì thay bản cũ. Cập nhật điểm và số đánh giá của quán."""
    p = conn.execute("select stars, review_count from places where id=?", (place_id,)).fetchone()
    old = conn.execute("select id, rating from reviews where user_id=? and place_id=?", (user_id, place_id)).fetchone()
    n, s = int(p["review_count"] or 0), float(p["stars"] or 0)
    total = s * n
    if old:
        total -= old["rating"] / 2
        n = max(n - 1, 0)
        conn.execute("delete from reviews where id=?", (old["id"],))
    else:
        conn.execute("update users set total_reviews = total_reviews + 1 where id=?", (user_id,))
    total, n = max(total, 0) + rating / 2, n + 1   # stars dùng thang 5 như dữ liệu đã xử lý
    conn.execute("update places set stars=?, review_count=? where id=?", (total / n, n, place_id))
    cur = conn.execute(
        "insert into reviews(user_id, place_id, rating, ts, created_at, title, text, pictures, part, is_new) "
        "values(?,?,?,?,?,?,?,?,NULL,1)", (user_id, place_id, rating, ts, created_at, title or None, text or None, "[]"))
    conn.commit()
    return cur.lastrowid


def create_user(conn, name: str, prefs: dict | None) -> int:
    nid = conn.execute("select coalesce(max(id), -1) + 1 from users").fetchone()[0]
    conn.execute("insert into users(id, name, is_new, prefs, total_reviews) values(?,?,1,?,0)",
                 (nid, name, json.dumps(prefs, ensure_ascii=False) if prefs else None))
    conn.commit()
    return nid


def create_place(conn, data: dict) -> int:
    nid = conn.execute("select coalesce(max(id), -1) + 1 from places").fetchone()[0]
    cols = [c for c in PLACE_FIELDS if c in data]
    conn.execute(f"insert into places(id, is_new, review_count, {', '.join(cols)}) values(?,1,0,{', '.join('?' * len(cols))})",
                 [nid] + [data[c] for c in cols])
    conn.commit()
    return nid


def update_place(conn, place_id: int, data: dict) -> None:
    cols = [c for c in PLACE_FIELDS if c in data]
    if cols:
        conn.execute(f"update places set {', '.join(c + '=?' for c in cols)} where id=?", [data[c] for c in cols] + [place_id])
        conn.commit()
