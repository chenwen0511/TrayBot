"""事件类型 → 地图状态映射（与前端 mock 坐标对齐）。"""

from __future__ import annotations

from traybot_protocol.models import LiveEventType, RobotLocation

# 与 backend/maps/factory_01.json 地标对齐 (scale2d=20)
LANDMARKS = {
    "home": {"x": 34, "y": 208},
    "pickup": {"x": 294, "y": 72},
    "delivery": {"x": 268, "y": 198},
}

_OPERATING_AT_PICKUP = frozenset({
    LiveEventType.ARRIVED_PICKUP,
    LiveEventType.PICK_PERCEIVE,
    LiveEventType.PICK_VALIDATE,
    LiveEventType.PICK_EXECUTE,
    LiveEventType.PICK_IN_HAND,
    LiveEventType.PICK_RETRY,
    LiveEventType.GRAB_SUCCESS,
    LiveEventType.PUT_BACKPACK,
})

_OPERATING_AT_DELIVERY = frozenset({
    LiveEventType.ARRIVED_DELIVERY,
    LiveEventType.TAKING_OUT,
    LiveEventType.PLACE_PERCEIVE,
    LiveEventType.PLACE_VALIDATE,
    LiveEventType.PLACE_EXECUTE,
    LiveEventType.PLACE_VERIFY,
    LiveEventType.PLACE_RETRY,
    LiveEventType.PUT_SHELF_SUCCESS,
    LiveEventType.BATCH_DECISION,
})

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
    LiveEventType.NAV_TO_DELIVERY: {
        "move": ("pickup", "delivery"),
        "active_route": "pickup-delivery",
        "mode": "navigating",
        "speed": 0.35,
    },
    LiveEventType.RETURN_HOME: {
        "move": ("delivery", "home"),
        "active_route": "delivery-home",
        "mode": "navigating",
        "speed": 0.35,
    },
}


def _operating_meta(at: str) -> dict:
    return {"at": at, "active_route": None, "mode": "operating", "speed": 0.0}


for _evt in _OPERATING_AT_PICKUP:
    EVENT_MAP[_evt] = _operating_meta("pickup")

for _evt in _OPERATING_AT_DELIVERY:
    EVENT_MAP[_evt] = _operating_meta("delivery")


def state_patch_for_event(
    event_type: LiveEventType,
    title: str,
    task_id: str,
    *,
    nav_from: str | None = None,
    active_route: str | None = None,
    backpack_count: int | None = None,
) -> dict:
    meta = EVENT_MAP[event_type]
    route = active_route or meta.get("active_route")
    patch: dict = {
        "robot": {"mode": meta["mode"], "speed": meta["speed"], "taskId": task_id},
        "map": {"currentStepTitle": title, "activeRoute": route},
    }
    if backpack_count is not None:
        patch["robot"]["backpackTrays"] = backpack_count

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
