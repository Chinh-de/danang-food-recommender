import numpy as np
import pandas as pd
import pytest

from app import config
from app.recsys.graph import ui_weight
from app.recsys.loader import embed, load_frames


def test_embeddings_match_notebook(conn):
    # đồ thị train + valid, đúng như notebook dùng khi lưu vector (ô 26)
    places, users, hist = load_frames(conn, parts=("train", "valid"))
    _, _, Eu, Ei = embed(places, users, hist)
    assert np.abs(Eu - np.load(config.ARTIFACTS / "user_emb.npy")).max() < 1e-4
    assert np.abs(Ei - np.load(config.ARTIFACTS / "item_emb.npy")).max() < 1e-4


def test_dynamic_weight_formula():
    hist = pd.DataFrame(dict(u=[0, 0], i=[0, 1], r=[1.0, 1.0], ts=[0, 180 * 86400]))
    w = ui_weight(hist, "dynamic")
    assert w[1] == pytest.approx(1.0) and w[0] == pytest.approx(0.2 + 0.8 * np.exp(-1), abs=1e-6)


def test_new_nodes_get_vectors(conn):
    places, users, hist = load_frames(conn)
    new_place = places.iloc[[0]].assign(id=len(places), is_new=1, stars=None, review_count=0)
    new_user = users.iloc[[0]].assign(id=len(users), is_new=1)
    places, users = pd.concat([places, new_place]), pd.concat([users, new_user])
    hist = pd.concat([hist, pd.DataFrame(dict(u=[len(users) - 1], i=[0], rating=[9.0], r=[0.9], ts=[hist["ts"].max() + 1]))])
    _, _, Eu, Ei = embed(places, users, hist)
    assert np.linalg.norm(Eu[-1]) > 0 and np.linalg.norm(Ei[-1]) > 0
    assert 0.2 < np.linalg.norm(Ei[-1]) / np.median(np.linalg.norm(Ei[:-1], axis=1)) < 5
