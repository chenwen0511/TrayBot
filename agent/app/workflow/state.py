"""LangGraph 工作流状态（端侧专用）。"""

from __future__ import annotations

from typing import Annotated

from traybot_protocol.models import LiveEvent, RobotLocation, WorkOrder
from typing_extensions import TypedDict


def _merge_events(left: list[LiveEvent], right: list[LiveEvent]) -> list[LiveEvent]:
    return left + right


class WorkflowState(TypedDict):
    work_order: WorkOrder
    location: RobotLocation
    battery: float
    batch_size: int
    events: Annotated[list[LiveEvent], _merge_events]
    step_index: int
