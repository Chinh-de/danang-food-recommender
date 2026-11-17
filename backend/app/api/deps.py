"""Dependency dùng chung: Engine và các truy vấn đọc."""
import numpy as np
from fastapi import HTTPException, Request

from .. import schemas

REVIEW_SQL = ("select r.*, u.name as user_name, u.avatar as user_avatar, p.name as place_name, p.image_url as place_image "
              "from reviews r join users u on u.id = r.user_id join places p on p.id = r.place_id")


def get_engine(request: Request):
    return request.app.state.engine


def place_row(engine, place_id: int):
    P = engine.state.places
    if not 0 <= place_id < len(P):
        raise HTTPException(404, "Không tìm thấy quán")
    return P.iloc[place_id]


def user_row(engine, user_id: int):
    U = engine.state.users
    if not 0 <= user_id < len(U):
        raise HTTPException(404, "Không tìm thấy người dùng")
    return U.iloc[user_id]


def my_ratings(engine, user_id: int | None) -> dict:
    if user_id is None or not 0 <= user_id < len(engine.state.users):
        return {}
    h = engine.state.hist
    h = h[h["u"] == user_id]
    return dict(zip(h["i"].astype(int), h["rating"].astype(float)))


def cards(engine, ids, user_id=None) -> list:
    mine = my_ratings(engine, user_id)
    P = engine.state.places
    return [schemas.place_card(P.iloc[int(i)], mine.get(int(i))) for i in ids]


def reviews_page(engine, where: str, args, page_no: int, size: int):
    c = engine.conn()
    try:
        total = c.execute(f"select count(*) from reviews r where {where}", args).fetchone()[0]
        rows = c.execute(f"{REVIEW_SQL} where {where} order by r.ts desc, r.id desc limit ? offset ?",
                         (*args, size, (page_no - 1) * size)).fetchall()
    finally:
        c.close()
    return schemas.page([schemas.review_out(r) for r in rows], total, page_no, size)


def facet_counts(engine, col: str):
    P = engine.state.places
    P = P[P["is_hidden"] == 0]
    if col == "categories":
        vocab = set(engine.state.cat.cat_vocab)
        s = P["categories"].dropna().str.split(", ").explode()
        s = s[s.isin(vocab)]
    else:
        s = P[col].dropna()
    vc = s.value_counts()
    return [dict(name=k, count=int(v)) for k, v in vc.items()]


def np_int(x):
    return int(x) if isinstance(x, (np.integer, int)) else x
