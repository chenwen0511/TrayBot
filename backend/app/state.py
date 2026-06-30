"""Dashboard 运行时状态。"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class DashboardState:
    live_events: list[dict] = field(default_factory=list)
    robot: dict = field(default_factory=lambda: {
        "name": "TrayBot-01",
        "mode": "idle",
        "battery": 78,
        "batteryVoltage": 48.2,
        "cpuTemp": 52,
        "speed": 0,
        "uptime": "00:00:00",
        "taskId": None,
        "networkLatency": 12,
        "signalStrength": 92,
        "joints": [
            {"id": "j1", "name": "基座", "temperature": 38, "angle": 45.2},
            {"id": "j2", "name": "肩部", "temperature": 42, "angle": -12.5},
            {"id": "j3", "name": "肘部", "temperature": 44, "angle": 78.3},
            {"id": "j4", "name": "腕部1", "temperature": 39, "angle": -5.1},
            {"id": "j5", "name": "腕部2", "temperature": 37, "angle": 22.0},
            {"id": "j6", "name": "夹爪", "temperature": 35, "angle": 0.0},
        ],
    })
    map_state: dict = field(default_factory=lambda: {
        "robotPos": {"x": 80, "y": 320},
        "currentStepTitle": "",
        "activeRoute": None,
    })

    MAX_EVENTS = 40

    def append_event(self, event: dict) -> dict:
        if any(e.get("id") == event.get("id") for e in self.live_events):
            return event
        self.live_events = [*self.live_events, event][-self.MAX_EVENTS :]
        return event

    def patch_robot(self, patch: dict) -> None:
        self.robot = {**self.robot, **patch}

    def patch_map(self, patch: dict) -> None:
        self.map_state = {**self.map_state, **patch}

    def snapshot(self, work_orders: list[dict]) -> dict:
        return {
            "liveEvents": self.live_events,
            "workOrders": work_orders,
            "robotStatus": self.robot,
            "mapState": self.map_state,
        }
