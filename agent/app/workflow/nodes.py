"""LangGraph 主工作流节点（单图扁平实现，无 subagent）。"""

from __future__ import annotations

from app.workflow.emit import emit_event
from app.workflow.state import WorkflowState
from traybot_protocol.models import (
    MAX_PICK_RETRIES,
    MAX_PLACE_RETRIES,
    MAX_TAKE_RETRIES,
    MIN_BATTERY_PERCENT,
    LiveEventType,
    RobotLocation,
    WorkOrder,
)


# ── 工单 / 导航 ──────────────────────────────────────────────


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
    return {
        **emit_event(
            state,
            event_type=LiveEventType.ARRIVED_DELIVERY,
            title="抵达送料货架",
            description=f"已到达 {wo.delivery}，先估计放置位姿再逐盘放置",
            location=RobotLocation.DELIVERY,
        ),
        "place_scan_index": 0,
    }


# ── Pick（抓取）──────────────────────────────────────────────


def enter_pick(state: WorkflowState) -> dict:
    return {"pick_attempt": 1, "pick_in_hand_ok": False}


def pick_pem(state: WorkflowState) -> dict:
    wo = state["work_order"]
    tray_idx = state["backpack_count"] + wo.delivered_trays + 1
    return {
        **emit_event(
            state,
            event_type=LiveEventType.PICK_PEM,
            title="抓取位姿估计",
            description=f"扫描货架层位，估计第 {tray_idx} 盘抓取位姿 A-03-L3-S{tray_idx % 3 + 1}",
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


def load_decision(state: WorkflowState) -> dict:
    """取料批次决策：继续抓取或前往投递（图文直播 Thinking）。"""
    wo: WorkOrder = state["work_order"]
    remaining = wo.total_trays - wo.delivered_trays
    count = state["backpack_count"]
    go_deliver = count >= wo.backpack_capacity or count >= remaining
    still_on_shelf = remaining - count

    if go_deliver:
        reason = (
            f"背包已满（{count}/{wo.backpack_capacity}）"
            if count >= wo.backpack_capacity
            else f"本批已取完所需（{count}/{remaining} 盘待送）"
        )
        thinking = (
            f"背包状态：现有 {count}/{wo.backpack_capacity} 盘。\n"
            f"工单进度：已送达 {wo.delivered_trays}/{wo.total_trays}，"
            f"本批待送 {count} 盘，货架剩余待取 {still_on_shelf} 盘。\n"
            f"判定：{reason}。\n"
            f"决策：携带本批 {count} 盘，导航前往 {wo.delivery} 投递。"
        )
        return emit_event(
            state,
            event_type=LiveEventType.LOAD_DECISION,
            title="决策：前往投递",
            description=f"本批 {count} 盘，目标 {wo.delivery}",
            thinking=thinking,
            location=RobotLocation.PICKUP,
        )

    thinking = (
        f"背包状态：现有 {count}/{wo.backpack_capacity} 盘。\n"
        f"工单进度：已送达 {wo.delivered_trays}/{wo.total_trays}，"
        f"货架剩余待取 {still_on_shelf} 盘。\n"
        f"判定：背包未满且尚有 {still_on_shelf} 盘待取。\n"
        f"决策：继续抓取下一盘。"
    )
    return emit_event(
        state,
        event_type=LiveEventType.LOAD_DECISION,
        title="决策：继续抓取",
        description=f"背包 {count}/{wo.backpack_capacity}，继续取料",
        thinking=thinking,
        location=RobotLocation.PICKUP,
    )


def route_after_load_decision(state: WorkflowState) -> str:
    wo = state["work_order"]
    remaining = wo.total_trays - wo.delivered_trays
    count = state["backpack_count"]
    if count >= wo.backpack_capacity or count >= remaining:
        return "nav_to_delivery"
    return "enter_pick"


# ── Place（放置）──────────────────────────────────────────────


def _slot_label(state: WorkflowState) -> str:
    wo = state["work_order"]
    slot_idx = wo.delivered_trays + 1
    return f"B-07-L2-S{slot_idx % 4 + 1}"


def place_pem(state: WorkflowState) -> dict:
    """放置位姿估计：夹爪无料盘时用手腕相机扫描货架。"""
    wo = state["work_order"]
    slot = _slot_label(state)
    scan_idx = state.get("place_scan_index", 0)
    remaining = state["backpack_count"]
    if scan_idx == 0:
        title = "放置位姿估计"
        description = (
            f"手腕相机扫描 {wo.delivery}（夹爪空手，视野无遮挡），"
            f"估计空位 {slot} 并输出想象图"
        )
    else:
        title = "下一放置位姿估计"
        description = (
            f"上一盘已放置，手腕相机重新扫描货架，"
            f"估计下一空位 {slot} 并输出想象图（背包剩余 {remaining} 盘）"
        )
    return {
        **emit_event(
            state,
            event_type=LiveEventType.PLACE_PEM,
            title=title,
            description=description,
            location=RobotLocation.DELIVERY,
        ),
        "target_slot": slot,
        "place_scan_index": scan_idx + 1,
        "place_verify_ok": False,
    }


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


def check_in_hand(state: WorkflowState) -> dict:
    """取背包后检测夹爪是否持盘。"""
    attempt = state["take_attempt"]
    simulate_fail = (
        attempt == 1
        and state["batch_number"] == 1
        and state["work_order"].delivered_trays == 0
    )
    if simulate_fail:
        next_attempt = attempt + 1
        if next_attempt > MAX_TAKE_RETRIES:
            raise RuntimeError("取料失败：超过最大重试次数")
        restored = state["backpack_count"] + 1
        return {
            **emit_event(
                state,
                event_type=LiveEventType.CHECK_IN_HAND,
                title="在手检测未通过",
                description="夹爪未检测到料盘，料盘仍在背包，重新取料",
                location=RobotLocation.DELIVERY,
            ),
            "check_in_hand_ok": False,
            "take_attempt": next_attempt,
            "backpack_count": restored,
        }
    return {
        **emit_event(
            state,
            event_type=LiveEventType.CHECK_IN_HAND,
            title="在手检测通过",
            description="力矩与视觉确认料盘稳定夹持",
            location=RobotLocation.DELIVERY,
        ),
        "check_in_hand_ok": True,
    }


def route_after_check_in_hand(state: WorkflowState) -> str:
    if state["check_in_hand_ok"]:
        return "enter_place"
    return "take_from_backpack"


def enter_place(state: WorkflowState) -> dict:
    return {"place_verify_ok": False}


def place_validate(state: WorkflowState) -> dict:
    slot = state.get("target_slot") or "未知槽位"
    attempt = state["place_attempt"]
    if attempt > 1:
        desc = f"基于想象图复核目标槽位 {slot}，放置路径无碰撞"
    else:
        desc = f"校验 place_pem 想象图：空位 {slot}，放置路径无碰撞，料盘与槽位对齐"
    return emit_event(
        state,
        event_type=LiveEventType.PLACE_VALIDATE,
        title="预想位姿校验",
        description=desc,
        location=RobotLocation.DELIVERY,
    ) | {"take_attempt": 1, "check_in_hand_ok": False}


def place_execute(state: WorkflowState) -> dict:
    slot = state.get("target_slot") or "未知槽位"
    attempt = state["place_attempt"]
    suffix = f"（第 {attempt} 次尝试）" if attempt > 1 else ""
    return emit_event(
        state,
        event_type=LiveEventType.PLACE_EXECUTE,
        title="执行放置",
        description=f"将料盘插入 {slot}{suffix}",
        location=RobotLocation.DELIVERY,
    )


def place_verify(state: WorkflowState) -> dict:
    attempt = state["place_attempt"]
    simulate_fail = (
        attempt == 1
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
    wo = state["work_order"]
    attempt = state["place_attempt"] + 1
    returned = state["backpack_count"] + 1
    return {
        **emit_event(
            state,
            event_type=LiveEventType.PLACE_RETRY,
            title="放置重试",
            description=(
                f"放置失败，料盘退回背包（{returned}/{wo.backpack_capacity} 盘），"
                f"返回 place_pem 重新估计位姿，开始第 {attempt} 次放置"
            ),
            location=RobotLocation.DELIVERY,
        ),
        "place_attempt": attempt,
        "place_verify_ok": False,
        "backpack_count": returned,
    }


def put_shelf_success(state: WorkflowState) -> dict:
    wo = state["work_order"]
    delivered = wo.delivered_trays + 1
    slot = state.get("target_slot") or ""
    return emit_event(
        state,
        event_type=LiveEventType.PUT_SHELF_SUCCESS,
        title="放入货架成功",
        description=f"已插入 {slot}，累计 {delivered}/{wo.total_trays} 盘",
        location=RobotLocation.DELIVERY,
        delivered_trays=delivered,
    ) | {"place_attempt": 1}


def route_after_place_verify(state: WorkflowState) -> str:
    if state["place_verify_ok"]:
        return "put_shelf_success"
    if state["place_attempt"] < MAX_PLACE_RETRIES:
        return "place_retry"
    raise RuntimeError("放置失败：超过最大重试次数")


def route_after_put_shelf(state: WorkflowState) -> str:
    if state["backpack_count"] > 0:
        return "place_pem"
    return "batch_decision"


# ── 批次决策 / 返航 ──────────────────────────────────────────


def batch_decision(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    remaining = wo.total_trays - wo.delivered_trays

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
