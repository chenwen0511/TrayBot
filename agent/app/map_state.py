"""事件类型 → 地图状态映射（与前端 mock 坐标对齐）。"""

from __future__ import annotations

from traybot_protocol.models import LiveEventType, RobotLocation

LANDMARKS = {
    "home": {"x": 80, "y": 320},
    "pickup": {"x": 200, "y": 80},
    "delivery": {"x": 520, "y": 80},
}

EVENT_MAP: dict[LiveEventType, dict] = {
    LiveEventType.ORDER_RECEIVED: {
        "at": "home",
        "active_route": None,
        "mode": "operating",
        "speed": 0.0,
    },
    LiveEventType.NAV_TO_PICKUP: {
        "move": ("home", "pickup"),
        "active_route": "home-pickup",
        "mode": "navigating",
        "speed": 0.35,
    },
    LiveEventType.ARRIVED_PICKUP: {
        "at": "pickup",
        "active_route": None,
        "mode": "operating",
        "speed": 0.0,
    },
    LiveEventType.TARGET_LOCKED: {"at": "pickup", "active_route": None, "mode": "operating", "speed": 0.0},
    LiveEventType.GRAB_SUCCESS: {"at": "pickup", "active_route": None, "mode": "operating", "speed": 0.0},
    LiveEventType.PUT_BACKPACK: {"at": "pickup", "active_route": None, "mode": "operating", "speed": 0.0},
    LiveEventType.NAV_TO_DELIVERY: {
        "move": ("pickup", "delivery"),
        "active_route": "pickup-delivery",
        "mode": "navigating",
        "speed": 0.35,
    },
    LiveEventType.ARRIVED_DELIVERY: {
        "at": "delivery",
        "active_route": None,
        "mode": "operating",
        "speed": 0.0,
    },
    LiveEventType.TAKING_OUT: {"at": "delivery", "active_route": None, "mode": "operating", "speed": 0.0},
    LiveEventType.PUT_SHELF_SUCCESS: {"at": "delivery", "active_route": None, "mode": "operating", "speed": 0.0},
    LiveEventType.BATCH_DECISION: {"at": "delivery", "active_route": None, "mode": "operating", "speed": 0.0},
    LiveEventType.RETURN_HOME: {
        "move": ("delivery", "home"),
        "active_route": "delivery-home",
        "mode": "navigating",
        "speed": 0.35,
    },
}


def state_patch_for_event(
    event_type: LiveEventType,
    title: str,
    task_id: str,
    *,
    nav_from: str | None = None,
    active_route: str | None = None,
) -> dict:
    meta = EVENT_MAP[event_type]
    route = active_route or meta.get("active_route")
    patch: dict = {
        "robot": {"mode": meta["mode"], "speed": meta["speed"], "taskId": task_id},
        "map": {"currentStepTitle": title, "activeRoute": route},
    }
    if event_type == LiveEventType.NAV_TO_PICKUP and (
        nav_from == "delivery" or active_route == "delivery-pickup"
    ):
        patch["map"]["robotPos"] = LANDMARKS["delivery"]
        patch["map"]["move"] = {"from": "delivery", "to": "pickup"}
        patch["map"]["activeRoute"] = "delivery-pickup"
        patch["robot"]["mode"] = "navigating"
        patch["robot"]["speed"] = 0.35
        return patch
    if "at" in meta:
        pos = LANDMARKS[meta["at"]]
        patch["map"]["robotPos"] = pos
    elif "move" in meta:
        _from, _to = meta["move"]
        patch["map"]["robotPos"] = LANDMARKS[_from]
        patch["map"]["move"] = {"from": _from, "to": _to}
    return patch


def location_to_robot_pos(location: RobotLocation) -> dict:
    return LANDMARKS[location.value]
