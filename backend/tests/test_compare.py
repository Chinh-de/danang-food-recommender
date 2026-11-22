import numpy as np
import pytest

from app.recsys.compare import Comparer
from app.recsys.engine import Engine


@pytest.fixture(scope="module")
def cmp():
    return Comparer(Engine())


def test_popularity_not_personal(cmp):
    W = cmp.now_world()
    s = W.scores("pop", [0, 1])
    assert np.array_equal(s[0], s[1])


def test_columns_exclude_seen(cmp):
    d = cmp.compare(0, "now", 10, ["pop", "userknn", "itemknn", "svd", "content", "near", "gnn_bin", "full"])
    seen = set(cmp.now_world().seen[0].indices.tolist())
    for c in d["columns"]:
        assert len(c["items"]) == 10 and not seen & set(c["items"])


def test_itemknn_by_hand(cmp):
    W = cmp.now_world()
    u, j = 0, 5
    R = W.R.toarray()
    cos = lambda a, b: a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12)
    expect = sum(R[u, i] * cos(R[:, i], R[:, j]) for i in W.seen[u].indices if i != j)
    assert abs(W.scores("itemknn", [u])[0, j] - expect) < 1e-6


def test_holdout_hides_test(cmp):
    W, test, _, _ = cmp.hold_world()
    pairs = set(zip(test["u"], test["i"]))
    seen = W.seen.tocoo()
    assert not pairs & set(zip(seen.row.tolist(), seen.col.tolist()))


def test_summary_matches_notebook(cmp):
    rows = {r["key"]: r for r in cmp.summary()["rows"]}
    for k in ["gnn_bin", "gnn_rating", "gnn_dyn", "full"]:
        assert rows[k]["match"], k
    assert rows["full"]["metrics"]["NDCG@20"] > max(rows[k]["metrics"]["NDCG@20"] for k in ["pop", "userknn", "itemknn", "svd"])
