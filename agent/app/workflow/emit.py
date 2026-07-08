"""工作流事件发射辅助。"""

from __future__ import annotations

from app.media.frames import maybe_attach_frame
from app.workflow.state import WorkflowState
from traybot_protocol.models import LiveEvent, LiveEventType, RobotLocation, WorkOrder


def next_step(state: WorkflowState) -> int:
    return state["step_index"] + 1


def emit_event(
    state: WorkflowState,
    *,
    event_type: LiveEventType,
    title: str,
    description: str | None = None,
    thinking: str | None = None,
    active_route: str | None = None,
    visible: bool = True,
    location: RobotLocation | None = None,
    delivered_trays: int | None = None,
    backpack_count: int | None = None,
) -> dict:
    event = LiveEvent(
        type=event_type,
        title=title,
        description=description,
        thinking=thinking,
        active_route=active_route,
        visible=visible,
    )
    event = maybe_attach_frame(event, event_type=event_type)
    patch: dict = {"events": [event], "step_index": next_step(state)}
    if location is not None:
        patch["location"] = location
    if delivered_trays is not None:
        wo: WorkOrder = state["work_order"]
        patch["work_order"] = wo.model_copy(update={"delivered_trays": delivered_trays})
    if backpack_count is not None:
        patch["backpack_count"] = backpack_count
    return patch
