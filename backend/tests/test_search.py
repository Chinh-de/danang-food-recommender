import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_db):
    from app.main import app
    with TestClient(app) as c:
        yield c


def search(client, **params):
    return client.get("/api/places", params={"page_size": 100, **params}).json()


def ids(d):
    return [p["id"] for p in d["items"]]


def test_accent_insensitive(client):
    a, b = search(client, q="mi quang"), search(client, q="Mì Quảng")
    assert a["total"] > 0 and ids(a) == ids(b)


def test_personal_same_set_different_order(client):
    a = search(client, q="pizza", sort="personal", user_id=0)
    b = search(client, q="pizza", sort="personal", user_id=1)
    assert a["total"] == b["total"] > 1
    assert set(ids(a)) == set(ids(b)) and ids(a) != ids(b)


def test_personal_keeps_reviewed_places(client):
    rated = client.get("/api/users/0/reviews", params={"page_size": 1}).json()["items"][0]["place"]["id"]
    name = client.get(f"/api/places/{rated}").json()["name"]
    d = search(client, q=name, sort="personal", user_id=0)
    assert rated in ids(d)


def test_cold_user_prefers_chosen_category(client):
    u = client.post("/api/users", json={"name": "Thử tìm", "prefs": {"categories": ["Café/Dessert"]}}).json()["id"]
    d = search(client, sort="personal", user_id=u, page_size=20)
    assert sum("Café/Dessert" in p["categories"] for p in d["items"]) >= 15


def test_no_user_unchanged(client):
    d = search(client, q="pizza")
    stars = [p["stars"] or 0 for p in d["items"]]
    assert stars == sorted(stars, reverse=True)
