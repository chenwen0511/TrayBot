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
    TARGET_LOCKED = "target_locked"
    GRAB_SUCCESS = "grab_success"
    PUT_BACKPACK = "put_backpack"
    NAV_TO_DELIVERY = "nav_to_delivery"
    ARRIVED_DELIVERY = "arrived_delivery"
    TAKING_OUT = "taking_out"
    PUT_SHELF_SUCCESS = "put_shelf_success"
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

NODE_SEQUENCE: list[str] = [
    "order_received",
    "nav_to_pickup",
    "arrived_pickup",
    "target_locked",
    "grab_success",
    "put_backpack",
    "nav_to_delivery",
    "arrived_delivery",
    "taking_out",
    "put_shelf_success",
    "return_home",
]

THINKING_NODES: frozenset[str] = frozenset({
    "order_received",
    "arrived_pickup",
    "return_home",
})
