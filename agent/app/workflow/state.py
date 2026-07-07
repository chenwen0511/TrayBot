"""LangGraph 工作流状态（端侧专用）。"""

from __future__ import annotations

from typing import Annotated

from traybot_protocol.models import LiveEvent, RobotLocation, WorkOrder
from typing_extensions import TypedDict


def _merge_events(left: list[LiveEvent], right: list[LiveEvent]) -> list[LiveEvent]:
    if not right:
        return left
    seen = {e.id for e in left}
    merged = list(left)
    for event in right:
        if event.id not in seen:
            merged.append(event)
            seen.add(event.id)
    return merged


class WorkflowState(TypedDict):
    work_order: WorkOrder
    location: RobotLocation
    battery: float
    batch_number: int
    nav_from: str | None
    backpack_count: int
    pick_attempt: int
    place_attempt: int
    pick_in_hand_ok: bool
    place_verify_ok: bool
    events: Annotated[list[LiveEvent], _merge_events]
    step_index: int
