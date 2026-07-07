"""Pick 子图：感知 → 验证 → 执行 → 在手检测（失败重试）→ 抓取成功。"""

from __future__ import annotations

from app.workflow.emit import emit_event
from app.workflow.state import WorkflowState
from traybot_protocol.models import (
    MAX_PICK_RETRIES,
    LiveEventType,
    RobotLocation,
)


def pick_perceive(state: WorkflowState) -> dict:
    wo = state["work_order"]
    tray_idx = state["backpack_count"] + wo.delivered_trays + 1
    return {
        **emit_event(
            state,
            event_type=LiveEventType.PICK_PERCEIVE,
            title="感知并计算抓取位姿",
            description=f"扫描货架层位，计算第 {tray_idx} 盘抓取位姿 A-03-L3-S{tray_idx % 3 + 1}",
            location=RobotLocation.PICKUP,
        ),
        "pick_in_hand_ok": False,
    }


def pick_validate(state: WorkflowState) -> dict:
    return emit_event(
        state,
        event_type=LiveEventType.PICK_VALIDATE,
        title="预想位姿校验",
        description="碰撞检测通过，夹爪可达，预抓取姿态安全",
        location=RobotLocation.PICKUP,
    )


def pick_execute(state: WorkflowState) -> dict:
    attempt = state["pick_attempt"]
    suffix = f"（第 {attempt} 次尝试）" if attempt > 1 else ""
    return emit_event(
        state,
        event_type=LiveEventType.PICK_EXECUTE,
        title="执行抓取",
        description=f"夹爪闭合，提升料盘{suffix}",
        location=RobotLocation.PICKUP,
    )


def pick_in_hand(state: WorkflowState) -> dict:
    attempt = state["pick_attempt"]
    # 骨架：首次在手检测模拟失败一次，触发重试流程
    simulate_fail = attempt == 1 and state["backpack_count"] == 0 and state["batch_number"] == 1
    if simulate_fail:
        return {
            **emit_event(
                state,
                event_type=LiveEventType.PICK_IN_HAND,
                title="在手检测未通过",
                description="夹爪力矩异常，料盘可能滑落，准备重试",
                location=RobotLocation.PICKUP,
            ),
            "pick_in_hand_ok": False,
        }
    return {
        **emit_event(
            state,
            event_type=LiveEventType.PICK_IN_HAND,
            title="在手检测通过",
            description="力矩与视觉确认料盘稳定夹持",
            location=RobotLocation.PICKUP,
        ),
        "pick_in_hand_ok": True,
    }


def pick_retry(state: WorkflowState) -> dict:
    attempt = state["pick_attempt"] + 1
    return {
        **emit_event(
            state,
            event_type=LiveEventType.PICK_RETRY,
            title="抓取重试",
            description=f"释放并重新定位，开始第 {attempt} 次抓取",
            location=RobotLocation.PICKUP,
        ),
        "pick_attempt": attempt,
        "pick_in_hand_ok": False,
    }


def grab_success(state: WorkflowState) -> dict:
    return emit_event(
        state,
        event_type=LiveEventType.GRAB_SUCCESS,
        title="抓取成功",
        description="单盘抓取完成，准备放入背包",
        location=RobotLocation.PICKUP,
    )


def route_after_pick_in_hand(state: WorkflowState) -> str:
    if state["pick_in_hand_ok"]:
        return "grab_success"
    if state["pick_attempt"] < MAX_PICK_RETRIES:
        return "pick_retry"
    raise RuntimeError("抓取失败：超过最大重试次数")


def build_pick_subgraph():
    from langgraph.graph import END, START, StateGraph

    graph = StateGraph(WorkflowState)
    graph.add_node("pick_perceive", pick_perceive)
    graph.add_node("pick_validate", pick_validate)
    graph.add_node("pick_execute", pick_execute)
    graph.add_node("pick_in_hand", pick_in_hand)
    graph.add_node("pick_retry", pick_retry)
    graph.add_node("grab_success", grab_success)

    graph.add_edge(START, "pick_perceive")
    graph.add_edge("pick_perceive", "pick_validate")
    graph.add_edge("pick_validate", "pick_execute")
    graph.add_edge("pick_execute", "pick_in_hand")
    graph.add_conditional_edges(
        "pick_in_hand",
        route_after_pick_in_hand,
        {"grab_success": "grab_success", "pick_retry": "pick_retry"},
    )
    graph.add_edge("pick_retry", "pick_perceive")
    graph.add_edge("grab_success", END)
    return graph.compile()
