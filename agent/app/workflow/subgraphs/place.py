"""Place 子图：感知 → 验证 → 执行 → 放置检测（失败重试）→ 放置成功。"""

from __future__ import annotations

from app.workflow.emit import emit_event
from app.workflow.state import WorkflowState
from traybot_protocol.models import (
    MAX_PLACE_RETRIES,
    LiveEventType,
    RobotLocation,
)


def place_perceive(state: WorkflowState) -> dict:
    wo = state["work_order"]
    slot = wo.delivered_trays + 1
    return {
        **emit_event(
            state,
            event_type=LiveEventType.PLACE_PERCEIVE,
            title="感知并计算放置位姿",
            description=f"检测空位，计算第 {slot} 盘放置位姿 B-07-L2-S{slot % 4 + 1}",
            location=RobotLocation.DELIVERY,
        ),
        "place_verify_ok": False,
    }


def place_validate(state: WorkflowState) -> dict:
    return emit_event(
        state,
        event_type=LiveEventType.PLACE_VALIDATE,
        title="预想位姿校验",
        description="放置路径无碰撞，料盘与槽位对齐",
        location=RobotLocation.DELIVERY,
    )


def place_execute(state: WorkflowState) -> dict:
    attempt = state["place_attempt"]
    suffix = f"（第 {attempt} 次尝试）" if attempt > 1 else ""
    return emit_event(
        state,
        event_type=LiveEventType.PLACE_EXECUTE,
        title="执行放置",
        description=f"夹爪下降并释放料盘{suffix}",
        location=RobotLocation.DELIVERY,
    )


def place_verify(state: WorkflowState) -> dict:
    attempt = state["place_attempt"]
    # 骨架：送料第一批第一盘模拟放置检测失败一次
    simulate_fail = (
        attempt == 1
        and state["backpack_count"] == 0
        and state["batch_number"] == 1
        and state["work_order"].delivered_trays == 0
    )
    if simulate_fail:
        return {
            **emit_event(
                state,
                event_type=LiveEventType.PLACE_VERIFY,
                title="放置检测未通过",
                description="视觉复检偏移 3.2mm，超出阈值，准备重试",
                location=RobotLocation.DELIVERY,
            ),
            "place_verify_ok": False,
        }
    return {
        **emit_event(
            state,
            event_type=LiveEventType.PLACE_VERIFY,
            title="放置检测通过",
            description="视觉确认料盘已正确入槽",
            location=RobotLocation.DELIVERY,
        ),
        "place_verify_ok": True,
    }


def place_retry(state: WorkflowState) -> dict:
    attempt = state["place_attempt"] + 1
    return {
        **emit_event(
            state,
            event_type=LiveEventType.PLACE_RETRY,
            title="放置重试",
            description=f"重新夹持并校准，开始第 {attempt} 次放置",
            location=RobotLocation.DELIVERY,
        ),
        "place_attempt": attempt,
        "place_verify_ok": False,
    }


def put_shelf_success(state: WorkflowState) -> dict:
    wo = state["work_order"]
    delivered = wo.delivered_trays + 1
    return emit_event(
        state,
        event_type=LiveEventType.PUT_SHELF_SUCCESS,
        title="放入货架成功",
        description=f"单盘放置完成，累计 {delivered}/{wo.total_trays} 盘",
        location=RobotLocation.DELIVERY,
        delivered_trays=delivered,
    )


def route_after_place_verify(state: WorkflowState) -> str:
    if state["place_verify_ok"]:
        return "put_shelf_success"
    if state["place_attempt"] < MAX_PLACE_RETRIES:
        return "place_retry"
    raise RuntimeError("放置失败：超过最大重试次数")


def build_place_subgraph():
    from langgraph.graph import END, START, StateGraph

    graph = StateGraph(WorkflowState)
    graph.add_node("place_perceive", place_perceive)
    graph.add_node("place_validate", place_validate)
    graph.add_node("place_execute", place_execute)
    graph.add_node("place_verify", place_verify)
    graph.add_node("place_retry", place_retry)
    graph.add_node("put_shelf_success", put_shelf_success)

    graph.add_edge(START, "place_perceive")
    graph.add_edge("place_perceive", "place_validate")
    graph.add_edge("place_validate", "place_execute")
    graph.add_edge("place_execute", "place_verify")
    graph.add_conditional_edges(
        "place_verify",
        route_after_place_verify,
        {"put_shelf_success": "put_shelf_success", "place_retry": "place_retry"},
    )
    graph.add_edge("place_retry", "place_perceive")
    graph.add_edge("put_shelf_success", END)
    return graph.compile()
