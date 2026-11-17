import pytest
from fastapi.testclient import TestClient

SAMPLE_INPUT = dict(name="Quán Thử Nghiệm", address="1 Bạch Đằng", district="Quận Hải Châu", lat=16.07, lon=108.224,
                    categories=["Café/Dessert"], price=2, target_audience=["Cặp đôi"], delivery=False)


@pytest.fixture()
def client(tmp_db):
    from app.main import app
    with TestClient(app) as c:
        yield c


def test_home_without_user(client):
    d = client.get("/api/home").json()
    assert d["recommended"] is None and len(d["districts"]) > 0


def test_home_with_user(client):
    d = client.get("/api/home", params={"user_id": 0}).json()
    assert d["recommended"]["branch"] == "mo_hinh_chinh" and len(d["recommended"]["items"]) == 20
    assert all(p["my_rating"] >= 7 for p in d["revisit"])


def test_post_review_updates_recs(client):
    first = client.get("/api/recommendations", params={"user_id": 0}).json()["items"][0]["id"]
    assert client.post("/api/reviews", json={"user_id": 0, "place_id": first, "rating": 9}).status_code == 201
    ids = [p["id"] for p in client.get("/api/recommendations", params={"user_id": 0}).json()["items"]]
    assert first not in ids
    assert client.get(f"/api/places/{first}", params={"user_id": 0}).json()["my_rating"] == 9


def test_search_filters(client):
    items = client.get("/api/places", params={"district": "Quận Hải Châu", "q": "ca phe"}).json()["items"]
    assert items and all(p["district"] == "Quận Hải Châu" for p in items)


def test_validation(client):
    assert client.post("/api/reviews", json={"user_id": 0, "place_id": 0, "rating": 11}).status_code == 422
    assert client.get("/api/places/999999").status_code == 404
    assert client.post("/api/users", json={"name": "   "}).status_code == 422


def test_create_user_then_recs(client):
    u = client.post("/api/users", json={"name": "Lan"}).json()
    assert client.get("/api/recommendations", params={"user_id": u["id"]}).json()["branch"] == "nguoi_dung_moi_chua_co_lich_su"


def test_place_detail_fields(client):
    p = client.get("/api/places/3").json()
    assert {"opening", "is_open_now", "aspects", "lat", "price_label"} <= set(p) and len(p["aspects"]) == 5
    assert client.get("/api/places/3/reviews").json()["total"] > 0


# ---------- admin ----------
def test_add_place_appears_in_new(client):
    p = client.post("/api/admin/places", json=SAMPLE_INPUT).json()
    assert p["is_new"] and p["id"] in [x["id"] for x in client.get("/api/home", params={"user_id": 0}).json()["new_places"]]
    assert client.get("/api/admin/stats").json()["cold_places"] == 1


def test_missing_required_field(client):
    bad = {k: v for k, v in SAMPLE_INPUT.items() if k != "district"}
    assert client.post("/api/admin/places", json=bad).status_code == 422


def test_hide_place(client):
    client.put("/api/admin/places/3", json={"is_hidden": True})
    assert 3 not in [p["id"] for p in client.get("/api/places", params={"page_size": 100}).json()["items"]]
    assert client.get("/api/places/3").json()["is_hidden"] is True


def test_explain(client):
    e = client.get("/api/admin/explain", params={"user_id": 0}).json()
    assert e["branch"] == "mo_hinh_chinh" and len(e["items"][0]["criteria"]) == 14
