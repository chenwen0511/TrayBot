"""工单 API 测试。"""

from fastapi.testclient import TestClient

from app.server import app

client = TestClient(app)


def test_create_workorder():
    resp = client.post(
        "/api/workorders",
        json={
            "id": "WO-TEST-001",
            "totalTrays": 10,
            "pickup": "取料货架 A-04",
            "delivery": "送料货架 B-04",
        },
    )
    assert resp.status_code == 201
    data = resp.json()["workOrder"]
    assert data["id"] == "WO-TEST-001"
    assert data["status"] == "in_progress"


def test_create_duplicate_returns_409():
    payload = {
        "id": "WO-TEST-DUP",
        "totalTrays": 10,
        "pickup": "取料货架 A-04",
        "delivery": "送料货架 B-04",
    }
    assert client.post("/api/workorders", json=payload).status_code == 201
    assert client.post("/api/workorders", json=payload).status_code == 409


def test_get_map():
    resp = client.get("/api/map")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "factory_01"
    assert len(data["landmarks"]) >= 3
    assert any(l["id"] == "home" for l in data["landmarks"])
    assert any(l["id"] == "pickup" for l in data["landmarks"])
    assert any(l["id"] == "delivery" for l in data["landmarks"])
    assert len(data["regions"]) > 0
    assert len(data.get("blocks", [])) > 0
    assert data.get("unit") == "m"
    assert data["size"]["width"] == 30


def test_get_maps_list():
    resp = client.get("/api/maps")
    assert resp.status_code == 200
    assert "factory_01" in resp.json()["maps"]
