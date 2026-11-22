"""API admin: số liệu, quản lý quán, kiểm tra gợi ý."""
import numpy as np
from fastapi import APIRouter, Depends, Query

from .. import schemas
from .deps import cards, get_engine, place_row, user_row

router = APIRouter(prefix="/api/admin")


@router.get("/stats")
def stats(engine=Depends(get_engine)):
    S = engine.state
    U, P, H = S.users, S.places, S.hist
    n_rev_place = np.bincount(H["i"], minlength=len(P))
    c = engine.conn()
    try:
        new_reviews = c.execute("select count(*) from reviews where is_new = 1").fetchone()[0]
    finally:
        c.close()
    new_u = U["is_new"].to_numpy() == 1
    new_p = P["is_new"].to_numpy() == 1
    return dict(users=len(U), places=len(P), reviews=len(H), new_users=int(new_u.sum()), new_places=int(new_p.sum()),
                new_reviews=int(new_reviews),
                cold_users=int((new_u & (S.P["hist_len"] == 0)).sum()),
                cold_places=int((new_p & (n_rev_place == 0)).sum()),
                hidden_places=int((P["is_hidden"] == 1).sum()), last_reload_ms=round(engine.last_reload_ms, 1))


@router.get("/places")
def admin_places(q: str = "", page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                 include_hidden: bool = True, engine=Depends(get_engine)):
    P = engine.state.places
    m = np.ones(len(P), bool) if include_hidden else (P["is_hidden"] == 0).to_numpy()
    if q:
        f = schemas.fold(q)
        m &= P["name"].map(schemas.fold).str.contains(f, regex=False).to_numpy()
    ids = np.where(m)[0][::-1]           # mới thêm lên trước
    sel = ids[(page - 1) * page_size: page * page_size]
    return schemas.page(cards(engine, sel), len(ids), page, page_size)


@router.post("/places", status_code=201)
def create_place(body: schemas.PlaceIn, engine=Depends(get_engine)):
    pid = engine.add_place(schemas.place_to_db(body.model_dump()))
    return schemas.place_detail(engine.state.places.iloc[pid])


@router.put("/places/{place_id}")
def update_place(place_id: int, body: schemas.PlaceUpdate, engine=Depends(get_engine)):
    place_row(engine, place_id)
    engine.update_place(place_id, schemas.place_to_db(body.model_dump(exclude_unset=True)))
    return schemas.place_detail(engine.state.places.iloc[place_id])


@router.get("/explain")
def explain(user_id: int, k: int = Query(20, ge=1, le=100), engine=Depends(get_engine)):
    u = user_row(engine, user_id)
    r = engine.recommend(user_id, k, explain=True)
    base = cards(engine, [x.place_id for x in r.items], user_id)
    items = [b | dict(rank=n + 1, score=x.score, gnn_score=x.gnn_score, criteria=x.criteria)
             for n, (b, x) in enumerate(zip(base, r.items))]
    return dict(user=schemas.user_out(u), branch=r.branch, history_count=int(engine.state.P["hist_len"][user_id]),
                items=items)


# ---------- so sánh mô hình ----------
def comparer(engine):
    from ..recsys.compare import get_comparer
    return get_comparer(engine)


@router.get("/compare/models")
def compare_models(engine=Depends(get_engine)):
    return comparer(engine).models()


@router.get("/compare")
def compare(user_id: int, mode: str = Query("now", pattern="^(now|holdout)$"), k: int = Query(10, ge=5, le=20),
            models: str = "", engine=Depends(get_engine)):
    u = user_row(engine, user_id)
    d = comparer(engine).compare(user_id, mode, k, [m for m in models.split(",") if m])
    ids = {i for c in d.get("columns", []) for i in c["items"]} | set(d.get("targets", []))
    P = engine.state.places
    d["places"] = {int(i): schemas.place_card(P.iloc[int(i)]) | dict(lat=float(P.iloc[int(i)]["lat"]), lon=float(P.iloc[int(i)]["lon"]))
                   for i in ids}
    d["user"] = schemas.user_out(u)
    return d


@router.get("/compare/summary")
def compare_summary(engine=Depends(get_engine)):
    return comparer(engine).summary()
