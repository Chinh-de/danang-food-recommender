import shutil

import pytest

from app import config, db

REAL_DB = config.ROOT / "data" / "foodgo.db"


@pytest.fixture()
def conn():
    c = db.connect(REAL_DB)
    yield c
    c.close()


@pytest.fixture()
def tmp_db(tmp_path, monkeypatch):
    p = tmp_path / "foodgo.db"
    shutil.copy2(REAL_DB, p)
    monkeypatch.setenv("FOODGO_DB", str(p))
    return p
