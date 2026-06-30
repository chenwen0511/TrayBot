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
