"""Trực quan hóa các mô hình so sánh: điểm tính lại từ các thành phần phải bằng điểm mô hình dùng."""
import numpy as np
import pytest

from app import config
from app.recsys import trace, trace_models, zoo
from app.recsys.compare import get_comparer
from app.recsys.engine import Engine


@pytest.fixture(scope="module")
def engine():
    return Engine()


@pytest.fixture(scope="module")
def pid(engine):
    return engine.recommend(0, 20).items[2].place_id


@pytest.mark.parametrize("key", ["pop", "near", "content", "userknn", "itemknn", "svd", "gnn_bin", "gnn_rating", "gnn_dyn"])
def test_score_recomputed(engine, pid, key):
    d = trace.build(engine, 0, pid, model=key)
    R = d["ranking"]
    assert d["model"] == key and R["check"]["err"] < 1e-5
    W = get_comparer(engine).now_world()
    top = [int(x) for x in W.topk(key, [0], R["topk"])[0] if x >= 0]
    assert [x["id"] for x in R["top"]] == top                      # cùng danh sách với trang so sánh
    if R["in_topk"]:
        assert R["rank"] == top.index(pid) + 1


def test_gnn_variant_uses_own_weights(engine, pid):
    d = trace.build(engine, 0, pid, model="gnn_bin")
    assert d["weights"]["mode"] == "binary" and all(e["w"] == 1 for e in d["weights"]["edges"])
    for L in d["layers"]:
        assert L["place"]["check"]["err"] < 1e-5 and L["user"]["check"]["err"] < 1e-5
    dyn = trace.build(engine, 0, pid, model="gnn_dyn")
    assert dyn["stage1"]["y"] == trace.build(engine, 0, pid)["stage1"]["y"]   # tầng 1 của mô hình chính


def test_gcn_with_fake_weights(engine, pid, monkeypatch):
    rng = np.random.default_rng(0)
    n0, d = engine.state.layout.n0, 64
    fake = {"emb_weight": rng.normal(0, 0.1, (n0, d))}
    for l in range(config.N_LAYERS):
        fake[f"lins_{l}_weight"], fake[f"lins_{l}_bias"] = rng.normal(0, 0.2, (d, d)), rng.normal(0, 0.01, d)
    monkeypatch.setattr(zoo, "load_gcn", lambda: fake)
    monkeypatch.setattr(trace_models, "load_gcn", lambda: fake)
    monkeypatch.setattr(trace_models, "available", lambda k: True)
    W = get_comparer(engine).now_world()
    for k in ("gcn", "gcn_A", "gcn_layers"):
        W._cache.pop(k, None)
    try:
        d = trace.build(engine, 0, pid, model="gcn")
        assert d["ranking"]["check"]["err"] < 1e-6
        for L in d["classic"]["layers"]:
            assert L["place"]["check"]["err"] < 1e-9 and L["user"]["check"]["err"] < 1e-9
    finally:
        for k in ("gcn", "gcn_A", "gcn_layers"):
            W._cache.pop(k, None)


def test_unavailable_model_rejected(engine, pid):
    with pytest.raises(ValueError):
        trace.build(engine, 0, pid, model="khong_co")


def test_cold_user_only_simple_models(tmp_db):
    e = Engine(tmp_db)
    u = e.add_user("Lạnh", {"categories": [], "districts": [], "prices": []})
    ok = {m["key"]: m["available"] for m in trace.build(e, u, 0)["models"]}
    assert ok["pop"] and ok["full"] and not ok["userknn"] and not ok["gnn_bin"]
    assert trace.build(e, u, 0, model="pop")["ranking"]["check"]["err"] == 0


def test_recommendation_list_by_model(engine):
    from app.api.public import recs
    W = get_comparer(engine).now_world()
    for key in ("userknn", "svd", "gnn_bin"):
        d = recs(engine, 0, 10, key)
        assert d["model"] == key and [x["id"] for x in d["items"]] == [int(x) for x in W.topk(key, [0], 10)[0]]
    assert [x["id"] for x in recs(engine, 0, 10)["items"]] == [x.place_id for x in engine.recommend(0, 10).items]
