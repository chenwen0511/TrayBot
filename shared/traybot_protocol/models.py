"""共享数据模型，与 front/src/types/index.ts 对齐。"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class LiveEventType(StrEnum):
    ORDER_RECEIVED = "order_received"
    NAV_TO_PICKUP = "nav_to_pickup"
    ARRIVED_PICKUP = "arrived_pickup"
    # Pick
    PICK_PEM = "pick_pem"
    PICK_VALIDATE = "pick_validate"
    PICK_EXECUTE = "pick_execute"
    PICK_IN_HAND = "pick_in_hand"
    PICK_RETRY = "pick_retry"
    GRAB_SUCCESS = "grab_success"
    PUT_BACKPACK = "put_backpack"
    NAV_TO_DELIVERY = "nav_to_delivery"
    ARRIVED_DELIVERY = "arrived_delivery"
    TAKING_OUT = "taking_out"
    CHECK_IN_HAND = "check_in_hand"
    # Place：place_pem 输出想象图 → place_validate → 取背包放置
    PLACE_PEM = "place_pem"
    PLACE_VALIDATE = "place_validate"
    PLACE_EXECUTE = "place_execute"
    PLACE_VERIFY = "place_verify"
    PLACE_RETRY = "place_retry"
    PUT_SHELF_SUCCESS = "put_shelf_success"
    BATCH_DECISION = "batch_decision"
    RETURN_HOME = "return_home"


class WorkOrderStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class RobotLocation(StrEnum):
    HOME = "home"
    PICKUP = "pickup"
    DELIVERY = "delivery"


class LiveEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"evt-{uuid4().hex[:12]}")
    type: LiveEventType
    title: str
    description: str | None = None
    thinking: str | None = None
    active_route: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    visible: bool = True

    def to_feed_dict(self) -> dict:
        data: dict = {
            "id": self.id,
            "type": self.type.value,
            "title": self.title,
            "timestamp": self.timestamp.isoformat(),
            "visible": self.visible,
        }
        if self.description:
            data["description"] = self.description
        if self.thinking:
            data["thinking"] = self.thinking
        if self.active_route:
            data["activeRoute"] = self.active_route
        return data


class WorkOrder(BaseModel):
    id: str
    total_trays: int
    delivered_trays: int = 0
    pickup: str
    delivery: str
    backpack_capacity: int = 20
    status: WorkOrderStatus = WorkOrderStatus.PENDING

    def to_feed_dict(self) -> dict:
        return {
            "id": self.id,
            "totalTrays": self.total_trays,
            "deliveredTrays": self.delivered_trays,
            "pickup": self.pickup,
            "delivery": self.delivery,
            "status": self.status.value,
            "backpackCapacity": self.backpack_capacity,
        }


DEFAULT_WORK_ORDER = WorkOrder(
    id="WO-20260629-001",
    total_trays=35,
    delivered_trays=0,
    pickup="取料货架 A-03",
    delivery="送料货架 B-07",
    backpack_capacity=20,
    status=WorkOrderStatus.IN_PROGRESS,
)

MAIN_GRAPH_NODES: list[str] = [
    "order_received",
    "nav_to_pickup",
    "arrived_pickup",
    "enter_pick",
    "pick_pem",
    "pick_validate",
    "pick_execute",
    "pick_in_hand",
    "pick_retry",
    "grab_success",
    "put_backpack",
    "nav_to_delivery",
    "arrived_delivery",
    "place_pem",
    "take_from_backpack",
    "check_in_hand",
    "enter_place",
    "place_validate",
    "place_execute",
    "place_verify",
    "place_retry",
    "put_shelf_success",
    "batch_decision",
    "return_home",
]

NODE_SEQUENCE: list[str] = MAIN_GRAPH_NODES

THINKING_NODES: frozenset[str] = frozenset({
    "order_received",
    "batch_decision",
})

MAX_PICK_RETRIES = 3
MAX_PLACE_RETRIES = 3
MAX_TAKE_RETRIES = 3

MIN_BATTERY_PERCENT = 20.0
