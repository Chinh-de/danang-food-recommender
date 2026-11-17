import pytest

from app import db
from app.recsys.engine import Engine

SAMPLE_PLACE = dict(name="Quán Thử Nghiệm", address="1 Bạch Đằng, Quận Hải Châu, Đà Nẵng", district="Quận Hải Châu",
                    lat=16.07, lon=108.224, categories="Café/Dessert", price=2.0, target_audience="Cặp đôi",
                    delivery=0.0, opening="[]")


@pytest.fixture()
def engine(tmp_db):
    return Engine(tmp_db)


def is_cafe(engine, i):
    return "Café/Dessert" in (engine.state.places.iloc[i]["categories"] or "")


def test_new_user_without_reviews_uses_simple_model(engine):
    u = engine.add_user("Khách mới", {"categories": ["Café/Dessert"], "prices": [], "districts": ["Quận Hải Châu"]})
    r = engine.recommend(u, 20)
    assert r.branch == "nguoi_dung_moi_chua_co_lich_su" and len(r.items) == 20
    assert sum(is_cafe(engine, x.place_id) for x in r.items) >= 10


def test_new_user_switches_after_first_review(engine):
    u = engine.add_user("Khách mới", None)
    engine.add_review(u, 0, 9.0, "", "")
    r = engine.recommend(u, 20)
    assert r.branch == "nguoi_dung_moi_co_lich_su" and len(r.items) == 20


def test_new_place_is_recommendable(engine):
    p = engine.add_place(SAMPLE_PLACE)
    assert p in engine.new_places(0)
    assert engine.personal_scores(0)[p] != 0


def test_new_user_reviewing_only_new_place(engine):
    p = engine.add_place(SAMPLE_PLACE | {"categories": "Danh mục lạ", "district": "Quận lạ",
                                         "target_audience": None, "price": None})
    u = engine.add_user("Khách mới", None)
    engine.add_review(u, p, 8.0, "", "")
    assert len(engine.recommend(u, 20).items) == 20


def test_hidden_place_disappears(engine):
    top = engine.recommend(0, 20).items[0].place_id
    engine.update_place(top, {"is_hidden": 1})
    assert top not in [x.place_id for x in engine.recommend(0, 20).items]
    assert all(top not in engine.similar(i) for i in range(20))
