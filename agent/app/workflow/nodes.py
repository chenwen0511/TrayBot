"""LangGraph 工作流节点。"""

from __future__ import annotations

from app.workflow.state import WorkflowState
from traybot_protocol.models import LiveEvent, LiveEventType, RobotLocation, WorkOrder


def _next_step(state: WorkflowState) -> int:
    return state["step_index"] + 1


def _emit(
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
) -> dict:
    event = LiveEvent(
        type=event_type,
        title=title,
        description=description,
        thinking=thinking,
        active_route=active_route,
        visible=visible,
    )
    patch: dict = {"events": [event], "step_index": _next_step(state)}
    if location is not None:
        patch["location"] = location
    if delivered_trays is not None:
        wo = state["work_order"]
        patch["work_order"] = wo.model_copy(update={"delivered_trays": delivered_trays})
    return patch


def order_received(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    batches = (wo.total_trays + wo.backpack_capacity - 1) // wo.backpack_capacity
    thinking = (
        f"解析工单：总量 {wo.total_trays} 盘，source={wo.pickup}，target={wo.delivery}。"
        f"背包容量 {wo.backpack_capacity} 盘，预计需 {batches} 批次完成。"
        f"当前位于 HOME，电量 {state['battery']:.0f}%，状态空闲，可接单。"
    )
    return _emit(
        state,
        event_type=LiveEventType.ORDER_RECEIVED,
        title="收到上料工单",
        description=f"工单 {wo.id}：需送 {wo.total_trays} 盘，背包容量 {wo.backpack_capacity} 盘/次",
        thinking=thinking,
        visible=False,
        location=RobotLocation.HOME,
    )


def nav_to_pickup(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    batch = state["batch_size"]
    remaining = wo.total_trays - wo.delivered_trays
    batch_num = state["batch_number"]
    from_delivery = batch_num > 1
    title = "继续前往取料货架" if from_delivery else "正在从 HOME 出发前往取料货架"
    if from_delivery:
        description = f"目标：{wo.pickup}，本轮取 {batch} 盘（剩余 {remaining} 盘）"
        active_route = "delivery-pickup"
        nav_from = "delivery"
    else:
        description = f"目标：{wo.pickup}，本轮取 {batch} 盘（工单需料总数：{wo.total_trays} 盘）"
        active_route = "home-pickup"
        nav_from = "home"
    patch = _emit(
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
    thinking = None
    if state["batch_number"] <= 1:
        thinking = (
            "定位误差 2.1cm，在允许范围内。扫描货架层位：第 3 层检测到 2 个托盘候选。"
            "比对工单物料编码，锁定目标位 A-03-L3-S2。"
        )
    return _emit(
        state,
        event_type=LiveEventType.ARRIVED_PICKUP,
        title="抵达取料货架",
        description=f"已到达 {wo.pickup}，开始定位目标托盘",
        thinking=thinking,
        location=RobotLocation.PICKUP,
    )


def target_locked(state: WorkflowState) -> dict:
    batch = state["batch_size"]
    return _emit(
        state,
        event_type=LiveEventType.TARGET_LOCKED,
        title="目标盘已锁定",
        description=f"视觉识别确认目标托盘，本轮需取 {batch} 盘",
        location=RobotLocation.PICKUP,
    )


def grab_success(state: WorkflowState) -> dict:
    batch = state["batch_size"]
    return _emit(
        state,
        event_type=LiveEventType.GRAB_SUCCESS,
        title="抓取成功",
        description=f"夹爪抓取完成，本轮 {batch} 盘已稳定",
        location=RobotLocation.PICKUP,
    )


def put_backpack(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    batch = state["batch_size"]
    return _emit(
        state,
        event_type=LiveEventType.PUT_BACKPACK,
        title="已放入背包",
        description=f"{batch} 盘已装入背包（{batch}/{wo.backpack_capacity}）",
        location=RobotLocation.PICKUP,
    )


def nav_to_delivery(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    batch = state["batch_size"]
    return _emit(
        state,
        event_type=LiveEventType.NAV_TO_DELIVERY,
        title="正在转场",
        description=f"目标：{wo.delivery}，运送 {batch} 盘",
        active_route="pickup-delivery",
    )


def arrived_delivery(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    return _emit(
        state,
        event_type=LiveEventType.ARRIVED_DELIVERY,
        title="抵达送料货架",
        description=f"已到达 {wo.delivery}，准备放料",
        location=RobotLocation.DELIVERY,
    )


def taking_out(state: WorkflowState) -> dict:
    batch = state["batch_size"]
    return _emit(
        state,
        event_type=LiveEventType.TAKING_OUT,
        title="正在取出",
        description=f"从背包取出 {batch} 盘，准备放入货架",
        location=RobotLocation.DELIVERY,
    )


def put_shelf_success(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    batch = state["batch_size"]
    delivered = wo.delivered_trays + batch
    return _emit(
        state,
        event_type=LiveEventType.PUT_SHELF_SUCCESS,
        title="放入货架成功",
        description=f"本轮送达 {batch} 盘，累计 {delivered}/{wo.total_trays} 盘",
        location=RobotLocation.DELIVERY,
        delivered_trays=delivered,
    )


def batch_decision(state: WorkflowState) -> dict:
    wo: WorkOrder = state["work_order"]
    remaining = wo.total_trays - wo.delivered_trays
    batch_size = state["batch_size"]
    capacity = wo.backpack_capacity

    if remaining > 0:
        next_batch = min(capacity, remaining)
        thinking = (
            f"工单总量 {wo.total_trays} 盘，背包容量 {capacity} 盘/次。"
            f"本轮已送 {batch_size} 盘，累计 {wo.delivered_trays}/{wo.total_trays}，剩余 {remaining} 盘。"
            f"{remaining} ≤ {capacity}，无需回 HOME 充电或待命，直接从送料点前往取料货架继续下一批次。"
            f"决策：前往 {wo.pickup}。"
        )
        patch = _emit(
            state,
            event_type=LiveEventType.BATCH_DECISION,
            title="决策：继续取料",
            description=(
                f"工单需 {wo.total_trays} 盘，已送 {wo.delivered_trays} 盘，还差 {remaining} 盘"
            ),
            thinking=thinking,
            location=RobotLocation.DELIVERY,
        )
        patch["batch_size"] = next_batch
        patch["batch_number"] = state["batch_number"] + 1
        return patch

    thinking = (
        f"累计送达 {wo.delivered_trays}/{wo.total_trays} 盘，工单已完成。"
        "查询任务队列：无其他待执行工单。"
        f"电量 {state['battery'] - 4:.0f}%，足够返回 HOME。"
        f"决策：从 {wo.delivery} 返回 HOME 待命。"
    )
    return _emit(
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
    return _emit(
        state,
        event_type=LiveEventType.RETURN_HOME,
        title="没有任务，机器人返回 HOME",
        description="任务队列空，自动返回 HOME 待命",
        active_route="delivery-home",
        location=RobotLocation.HOME,
    )


NODE_REGISTRY = {
    "order_received": order_received,
    "nav_to_pickup": nav_to_pickup,
    "arrived_pickup": arrived_pickup,
    "target_locked": target_locked,
    "grab_success": grab_success,
    "put_backpack": put_backpack,
    "nav_to_delivery": nav_to_delivery,
    "arrived_delivery": arrived_delivery,
    "taking_out": taking_out,
    "put_shelf_success": put_shelf_success,
    "batch_decision": batch_decision,
    "return_home": return_home,
}
