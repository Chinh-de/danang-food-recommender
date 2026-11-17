import lightgbm as lgb
import numpy as np
import pytest

from app import config
from app.recsys.features import build_phase, candidates, rank
from app.recsys.loader import embed, load_frames
from scripts.check_notebook import run_check


def test_metrics_match_notebook(conn):
    m = run_check(conn)
    assert m["NDCG@20"] == pytest.approx(0.1277, abs=0.002)
    assert m["Recall@20"] == pytest.approx(0.2363, abs=0.003)


@pytest.fixture(scope="module")
def state():
    from app import db
    from tests.conftest import REAL_DB
    c = db.connect(REAL_DB)
    places, users, hist = load_frames(c)
    cat, _, Eu, Ei = embed(places, users, hist)
    return hist, cat, Eu, Ei, build_phase(hist, cat, len(users)), lgb.Booster(model_file=str(config.ARTIFACTS / "ranker.txt"))


def test_history_excluded(state):
    hist, cat, Eu, Ei, P, b = state
    top, _, _ = rank(candidates(P, Eu, Ei, [0], cat), b, 20)
    assert not set(hist.loc[hist["u"] == 0, "i"]) & set(top[0][top[0] >= 0])


def test_allow_mask(state):
    hist, cat, Eu, Ei, P, b = state
    top, _, _ = rank(candidates(P, Eu, Ei, [0], cat), b, 20)
    allow = np.ones(cat.n_items, bool)
    allow[top[0][0]] = False
    top2, _, _ = rank(candidates(P, Eu, Ei, [0], cat, allow=allow), b, 20)
    assert top[0][0] not in top2[0]
