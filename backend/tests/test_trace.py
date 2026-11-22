import pytest

from app.recsys import trace
from app.recsys.engine import Engine


@pytest.fixture(scope="module")
def engine():
    return Engine()


def test_main_branch_checks(engine):
    pid = engine.recommend(0, 20).items[2].place_id
    d = trace.build(engine, 0, pid)
    assert d["branch"] == "mo_hinh_chinh"
    assert d["weights"]["check"]["err"] < 1e-3 and d["norm"]["check"]["err"] < 1e-4
    for L in d["layers"]:
        assert L["place"]["check"]["err"] < 1e-5 and L["user"]["check"]["err"] < 1e-5
    assert d["stage1"]["check_y"]["err"] < 1e-4 and d["stage1"]["in_top200"]
    assert d["criteria"]["real"] and len(d["criteria"]["criteria"]) == 14
    assert d["lgbm"]["check"]["err"] < 1e-5
    assert d["result"]["rank"] == d["result"]["engine_rank"] == 3


def test_place_outside_candidates(engine):
    s = engine.state.Eu[0] @ engine.state.Ei.T
    seen = set(engine.state.P["excl"][0].indices.tolist())
    pid = next(int(i) for i in s.argsort() if int(i) not in seen and not engine.state.cat.hidden[i])
    d = trace.build(engine, 0, pid)
    assert not d["stage1"]["in_top200"] and not d["criteria"]["real"] and not d["result"]["in_topk"]


def test_search_block(engine):
    d = trace.build(engine, 0, engine.recommend(0, 1).items[0].place_id, q="a")
    assert d["search"]["matched"] > 0


def test_cold_branch(tmp_db):
    e = Engine(tmp_db)
    u = e.add_user("Lạnh", {"categories": ["Café/Dessert"], "districts": [], "prices": []})
    d = trace.build(e, u, 0)
    assert d["branch"] == "nguoi_dung_moi_chua_co_lich_su" and d["cold"]["check"]["err"] < 1e-6
    assert "layers" not in d
