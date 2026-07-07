"""LangGraph 主编排节点。"""

from __future__ import annotations

from app.workflow.emit import emit_event
from app.workflow.state import WorkflowState
from traybot_protocol.models import (
    MIN_BATTERY_PERCENT,
    LiveEventType,
    RobotLocation,
    WorkOrder,
)


def order_received(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    battery = state["battery"]
    remaining = wo.total_trays - wo.delivered_trays
    batches = (remaining + wo.backpack_capacity - 1) // wo.backpack_capacity
    can_proceed = battery >= MIN_BATTERY_PERCENT

    thinking = (
        f"收到工单 {wo.id}：需送 {remaining} 盘，取料点 {wo.pickup}，送料点 {wo.delivery}。\n"
        f"自检：电量 {battery:.0f}%（阈值 {MIN_BATTERY_PERCENT:.0f}%），"
        f"{'通过' if can_proceed else '不足，拒绝执行'}；"
        f"夹爪/关节温度正常；背包容量 {wo.backpack_capacity} 盘，预计 {batches} 趟。\n"
        f"{'决策：电量与自检均满足，开始执行。' if can_proceed else '决策：电量不足，等待充电。'}"
    )
    if not can_proceed:
        raise RuntimeError(f"电量不足 ({battery:.0f}% < {MIN_BATTERY_PERCENT:.0f}%)，无法执行工单")

    return emit_event(
        state,
        event_type=LiveEventType.ORDER_RECEIVED,
        title="收到上料工单",
        description=f"工单 {wo.id}：需送 {remaining} 盘，背包容量 {wo.backpack_capacity} 盘",
        thinking=thinking,
        visible=False,
        location=RobotLocation.HOME,
    )


def nav_to_pickup(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    remaining = wo.total_trays - wo.delivered_trays
    batch_num = state["batch_number"]
    from_delivery = batch_num > 1
    title = "继续前往取料货架" if from_delivery else "导航前往取料货架"
    if from_delivery:
        description = f"目标：{wo.pickup}，背包空，剩余工单 {remaining} 盘"
        active_route = "delivery-pickup"
        nav_from = "delivery"
    else:
        description = f"目标：{wo.pickup}，工单共需 {wo.total_trays} 盘"
        active_route = "home-pickup"
        nav_from = "home"
    patch = emit_event(
        state,
        event_type=LiveEventType.NAV_TO_PICKUP,
        title=title,
        description=description,
        active_route=active_route,
    )
    patch["nav_from"] = nav_from
    return patch


def arrived_pickup(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    return emit_event(
        state,
        event_type=LiveEventType.ARRIVED_PICKUP,
        title="抵达取料货架",
        description=f"已到达 {wo.pickup}，开始逐盘抓取",
        location=RobotLocation.PICKUP,
    )


def enter_pick_tray(state: WorkflowState) -> dict:
    """进入 Pick 子图前重置单次抓取状态。"""
    return {"pick_attempt": 1, "pick_in_hand_ok": False}


def put_backpack(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    count = state["backpack_count"] + 1
    return emit_event(
        state,
        event_type=LiveEventType.PUT_BACKPACK,
        title="已放入背包",
        description=f"单盘入包，背包现有 {count}/{wo.backpack_capacity} 盘",
        location=RobotLocation.PICKUP,
        backpack_count=count,
    )


def route_after_put_backpack(state: WorkflowState) -> str:
    wo = state["work_order"]
    remaining = wo.total_trays - wo.delivered_trays
    count = state["backpack_count"]
    if count >= wo.backpack_capacity or count >= remaining:
        return "nav_to_delivery"
    return "enter_pick"


def nav_to_delivery(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    count = state["backpack_count"]
    return emit_event(
        state,
        event_type=LiveEventType.NAV_TO_DELIVERY,
        title="导航前往送料货架",
        description=f"目标：{wo.delivery}，运送 {count} 盘",
        active_route="pickup-delivery",
    )


def arrived_delivery(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    return emit_event(
        state,
        event_type=LiveEventType.ARRIVED_DELIVERY,
        title="抵达送料货架",
        description=f"已到达 {wo.delivery}，开始逐盘放置",
        location=RobotLocation.DELIVERY,
    )


def take_from_backpack(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    count = state["backpack_count"] - 1
    return emit_event(
        state,
        event_type=LiveEventType.TAKING_OUT,
        title="从背包取出料盘",
        description=f"取出 1 盘，背包剩余 {count}/{wo.backpack_capacity} 盘",
        location=RobotLocation.DELIVERY,
        backpack_count=count,
    )


def enter_place_tray(state: WorkflowState) -> dict:
    """进入 Place 子图前重置单次放置状态。"""
    return {"place_attempt": 1, "place_verify_ok": False}


def route_after_place_tray(state: WorkflowState) -> str:
    if state["backpack_count"] > 0:
        return "take_from_backpack"
    return "batch_decision"


def batch_decision(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    remaining = wo.total_trays - wo.delivered_trays
    capacity = wo.backpack_capacity

    if remaining > 0:
        thinking = (
            f"工单进度：已送 {wo.delivered_trays}/{wo.total_trays} 盘，剩余 {remaining} 盘。\n"
            f"背包已清空，电量 {state['battery'] - 2:.0f}%，自检正常。\n"
            f"决策：{remaining} 盘尚未完成，返回 {wo.pickup} 继续取料。"
        )
        patch = emit_event(
            state,
            event_type=LiveEventType.BATCH_DECISION,
            title="决策：继续取料",
            description=f"还差 {remaining} 盘，前往取料货架",
            thinking=thinking,
            location=RobotLocation.DELIVERY,
        )
        patch["batch_number"] = state["batch_number"] + 1
        return patch

    thinking = (
        f"工单 {wo.id} 已全部完成：累计送达 {wo.delivered_trays}/{wo.total_trays} 盘。\n"
        f"任务队列无待执行工单，电量 {state['battery'] - 4:.0f}% 足够返航。\n"
        f"决策：返回 HOME 待命。"
    )
    return emit_event(
        state,
        event_type=LiveEventType.BATCH_DECISION,
        title="决策：返回 HOME",
        description=f"工单 {wo.total_trays} 盘全部送达完成",
        thinking=thinking,
        location=RobotLocation.DELIVERY,
    )


def route_after_batch(state: WorkflowState) -> str:
    wo = state["work_order"]
    if wo.total_trays - wo.delivered_trays > 0:
        return "nav_to_pickup"
    return "return_home"


def return_home(state: WorkflowState) -> dict:
    return emit_event(
        state,
        event_type=LiveEventType.RETURN_HOME,
        title="返回 HOME",
        description="工单完成，机器人返回 HOME 待命",
        active_route="delivery-home",
        location=RobotLocation.HOME,
        backpack_count=0,
    )
