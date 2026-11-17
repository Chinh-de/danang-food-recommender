import pytest

from app import config, db
from app.recsys.engine import Engine


@pytest.fixture()
def engine(tmp_db):
    return Engine(tmp_db)


def count_reviews(engine, user, place):
    c = db.connect(engine.db_path)
    return c.execute("select count(*) from reviews where user_id=? and place_id=?", (user, place)).fetchone()[0]


def test_recommend_main_branch(engine):
    r = engine.recommend(0, k=20)
    assert r.branch == "mo_hinh_chinh" and len(r.items) == 20


def test_review_changes_recs_immediately(engine):
    before = [x.place_id for x in engine.recommend(0, 20).items]
    engine.add_review(0, before[0], 9.0, "ngon", "")
    after = [x.place_id for x in engine.recommend(0, 20).items]
    assert before[0] not in after and len(after) == 20


def test_review_twice_replaces(engine):
    engine.add_review(0, 5, 3.0, "", "")
    engine.add_review(0, 5, 9.0, "", "")
    assert count_reviews(engine, 0, 5) == 1


def test_explain_has_14_criteria(engine):
    it = engine.recommend(0, 5, explain=True).items[0]
    assert set(it.criteria) == set(config.META["static"] + config.META["dynamic"] + config.META["extra"])


def test_reload_time(engine):
    assert engine.reload() < 2.0


def test_revisit_from_history(engine):
    ids = engine.revisit(0)
    c = db.connect(engine.db_path)
    ratings = [c.execute("select rating from reviews where user_id=0 and place_id=?", (i,)).fetchone()[0] for i in ids]
    assert ids and all(r >= 7 for r in ratings)
