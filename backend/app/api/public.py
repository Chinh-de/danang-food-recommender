"""API phía người dùng."""
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query

from .. import config, schemas
from .deps import cards, facet_counts, get_engine, my_ratings, place_row, reviews_page, user_row

router = APIRouter(prefix="/api")


# ---------- người dùng ----------
@router.get("/users")
def list_users(q: str = "", page: int = Query(1, ge=1), page_size: int = Query(24, ge=1, le=100), engine=Depends(get_engine)):
    U = engine.state.users
    if q:
        U = U[U["name"].map(schemas.fold).str.contains(schemas.fold(q), regex=False)]
    U = U.sort_values(["is_new", "total_reviews"], ascending=[False, False])
    rows = U.iloc[(page - 1) * page_size: page * page_size]
    return schemas.page([schemas.user_out(r) for _, r in rows.iterrows()], len(U), page, page_size)


@router.get("/users/{user_id}")
def get_user(user_id: int, engine=Depends(get_engine)):
    return schemas.user_out(user_row(engine, user_id))


@router.get("/users/{user_id}/reviews")
def user_reviews(user_id: int, page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=50), engine=Depends(get_engine)):
    user_row(engine, user_id)
    return reviews_page(engine, "r.user_id = ?", (user_id,), page, page_size)


@router.post("/users", status_code=201)
def create_user(body: schemas.UserIn, engine=Depends(get_engine)):
    uid = engine.add_user(body.name, body.prefs.model_dump() if body.prefs else None)
    return schemas.user_out(engine.state.users.iloc[uid])


# ---------- quán ----------
@router.get("/places")
def list_places(q: str = "", district: str | None = None, category: str | None = None, price: int | None = None,
                open_now: bool = False, sort: str = "rating", user_id: int | None = None,
                page: int = Query(1, ge=1), page_size: int = Query(24, ge=1, le=100), engine=Depends(get_engine)):
    P = engine.state.places
    m = P["is_hidden"].to_numpy() == 0
    if q:
        f = schemas.fold(q)
        m &= (P["name"].map(schemas.fold).str.contains(f, regex=False)
              | P["address"].map(schemas.fold).str.contains(f, regex=False)).to_numpy()
    if district:
        m &= (P["district"] == district).to_numpy()
    if category:
        m &= P["categories"].fillna("").str.split(", ").map(lambda l: category in l).to_numpy()
    if price:
        m &= (P["price"] == price).to_numpy()
    if open_now:
        m &= P["opening"].map(lambda v: schemas.is_open_now(schemas.opening_list(v)) is True).to_numpy()
    ids = np.where(m)[0]
    ps = engine.personal_scores(user_id) if (sort == "personal" and user_id is not None
                                             and 0 <= user_id < len(engine.state.users)) else None
    if ps is not None:
        key = -ps[ids]
    elif sort == "reviews":
        key = -P["review_count"].to_numpy(float)[ids]
    else:
        key = -np.nan_to_num(P["stars"].to_numpy(float)[ids]) - 1e-4 * np.log1p(P["review_count"].to_numpy(float)[ids])
    ids = ids[np.argsort(key, kind="stable")]
    sel = ids[(page - 1) * page_size: page * page_size]
    return schemas.page(cards(engine, sel, user_id), len(ids), page, page_size)


@router.get("/places/{place_id}")
def get_place(place_id: int, user_id: int | None = None, engine=Depends(get_engine)):
    r = place_row(engine, place_id)
    return schemas.place_detail(r, my_ratings(engine, user_id).get(place_id))


@router.get("/places/{place_id}/reviews")
def place_reviews(place_id: int, page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=50), engine=Depends(get_engine)):
    place_row(engine, place_id)
    return reviews_page(engine, "r.place_id = ?", (place_id,), page, page_size)


@router.get("/places/{place_id}/similar")
def similar(place_id: int, k: int = Query(12, ge=1, le=50), user_id: int | None = None, engine=Depends(get_engine)):
    place_row(engine, place_id)
    return cards(engine, engine.similar(place_id, k), user_id)


# ---------- đánh giá, gợi ý ----------
@router.post("/reviews", status_code=201)
def create_review(body: schemas.ReviewIn, engine=Depends(get_engine)):
    user_row(engine, body.user_id)
    place_row(engine, body.place_id)
    rid = engine.add_review(body.user_id, body.place_id, body.rating, body.title, body.text)
    c = engine.conn()
    try:
        from .deps import REVIEW_SQL
        return schemas.review_out(c.execute(f"{REVIEW_SQL} where r.id = ?", (rid,)).fetchone())
    finally:
        c.close()


def recs(engine, user_id: int, k: int) -> dict:
    user_row(engine, user_id)
    r = engine.recommend(user_id, k)
    return dict(branch=r.branch, items=cards(engine, [x.place_id for x in r.items], user_id))


@router.get("/recommendations")
def recommendations(user_id: int, k: int = Query(20, ge=1, le=100), engine=Depends(get_engine)):
    return recs(engine, user_id, k)


@router.get("/home")
def home(user_id: int | None = None, engine=Depends(get_engine)):
    if user_id is not None:
        user_row(engine, user_id)
    return dict(
        recommended=recs(engine, user_id, 20) if user_id is not None else None,
        revisit=cards(engine, engine.revisit(user_id), user_id) if user_id is not None else [],
        new_places=cards(engine, engine.new_places(user_id), user_id),
        districts=facet_counts(engine, "district"),
        categories=facet_counts(engine, "categories")[:16],
    )


@router.get("/meta")
def meta(engine=Depends(get_engine)):
    cat = engine.state.cat
    return dict(districts=cat.districts, categories=cat.cat_vocab, audiences=cat.audiences,
                prices=[dict(value=k, label=v) for k, v in config.PRICE_LABELS.items()])
