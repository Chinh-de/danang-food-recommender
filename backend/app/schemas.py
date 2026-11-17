"""Kiểu dữ liệu vào của API và hàm chuyển dòng DB thành JSON trả về."""
import json
import unicodedata
from datetime import datetime

import pandas as pd
from pydantic import BaseModel, Field, field_validator

from . import config


class Prefs(BaseModel):
    categories: list[str] = []
    prices: list[int] = []
    districts: list[str] = []


class UserIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    prefs: Prefs | None = None

    @field_validator("name")
    @classmethod
    def strip(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Tên không được để trống")
        return v


class ReviewIn(BaseModel):
    user_id: int
    place_id: int
    rating: float = Field(ge=1, le=10)
    title: str | None = Field(default=None, max_length=200)
    text: str | None = Field(default=None, max_length=5000)


class PlaceIn(BaseModel):
    name: str = Field(min_length=1)
    address: str = Field(min_length=1)
    district: str = Field(min_length=1)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    categories: list[str] = Field(min_length=1)
    price: int | None = Field(default=None, ge=1, le=4)
    target_audience: list[str] = []
    delivery: bool = False
    image_url: str | None = None
    description: str | None = None
    phone: str | None = None
    opening: list[list[int]] = []


class PlaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    address: str | None = None
    district: str | None = None
    lat: float | None = None
    lon: float | None = None
    categories: list[str] | None = None
    price: int | None = Field(default=None, ge=1, le=4)
    target_audience: list[str] | None = None
    delivery: bool | None = None
    image_url: str | None = None
    description: str | None = None
    phone: str | None = None
    opening: list[list[int]] | None = None
    is_hidden: bool | None = None


def place_to_db(d: dict) -> dict:
    out = dict(d)
    for k in ("categories", "target_audience"):
        if k in out and out[k] is not None:
            out[k] = ", ".join(out[k]) or None
    if "opening" in out and out["opening"] is not None:
        out["opening"] = json.dumps(out["opening"])
    for k in ("delivery", "is_hidden"):
        if k in out and out[k] is not None:
            out[k] = float(out[k]) if k == "delivery" else int(out[k])
    if out.get("image_url"):
        out["image_full_url"] = out["image_url"]
    return out


def fold(s) -> str:
    s = unicodedata.normalize("NFD", str(s or "").lower()).replace("đ", "d")
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")


def _nn(v):
    return None if v is None or (isinstance(v, float) and pd.isna(v)) else v


def _split(v):
    return [x.strip() for x in v.split(",") if x.strip()] if isinstance(v, str) else []


def opening_list(v):
    try:
        return [list(map(int, t)) for t in json.loads(v)] if isinstance(v, str) else []
    except (ValueError, TypeError):
        return []


def is_open_now(opening) -> bool | None:
    # mọi khung giờ của Foody có DayOfWeek = 2 nên coi là áp dụng mỗi ngày
    if not opening:
        return None
    now = datetime.now()
    m = now.hour * 60 + now.minute
    for _, a, b in opening:
        if (a <= m < b) if a <= b else (m >= a or m < b):
            return True
    return False


def place_card(r, my_rating=None) -> dict:
    stars = _nn(r["stars"])
    return dict(id=int(r["id"]), name=r["name"], address=_nn(r["address"]), district=_nn(r["district"]),
                categories=_split(r["categories"]), price=_nn(r["price"]),
                stars=round(stars * 2, 1) if stars is not None else None,     # thang 10 như Foody
                review_count=int(r["review_count"] or 0), image_url=_nn(r["image_url"]),
                is_new=bool(r["is_new"]), is_hidden=bool(r["is_hidden"]), my_rating=my_rating)


def place_detail(r, my_rating=None) -> dict:
    op = opening_list(r["opening"])
    return place_card(r, my_rating) | dict(
        lat=r["lat"], lon=r["lon"], price_min=_nn(r["price_min"]), price_max=_nn(r["price_max"]),
        price_label=config.PRICE_LABELS.get(int(r["price"])) if _nn(r["price"]) else None,
        delivery=bool(_nn(r["delivery"]) or 0), target_audience=_split(r["target_audience"]),
        image_full_url=_nn(r["image_full_url"]) or _nn(r["image_url"]), description=_nn(r["description"]),
        phone=(_nn(r["phone"]) or "").strip(", ") or None, opening=op, is_open_now=is_open_now(op),
        aspects=[dict(name=n, score=_nn(r[f"asp_{k}"])) for k, n in enumerate(config.ASPECTS)])


def user_out(r) -> dict:
    prefs = json.loads(r["prefs"]) if isinstance(r["prefs"], str) else None
    return dict(id=int(r["id"]), name=r["name"], avatar=_nn(r["avatar"]), total_reviews=int(r["total_reviews"] or 0),
                is_new=bool(r["is_new"]), prefs=prefs)


def review_out(r) -> dict:
    try:
        pics = json.loads(r["pictures"] or "[]")
    except ValueError:
        pics = []
    return dict(id=int(r["id"]), rating=r["rating"], created_at=r["created_at"], title=r["title"], text=r["text"],
                pictures=pics, is_new=bool(r["is_new"]),
                user=dict(id=r["user_id"], name=r["user_name"], avatar=r["user_avatar"]),
                place=dict(id=r["place_id"], name=r["place_name"], image_url=r["place_image"]))


def page(items, total, page_no, size) -> dict:
    return dict(items=items, total=int(total), page=page_no, page_size=size)
