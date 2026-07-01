"""逐步执行 LangGraph 工作流并上报云端。"""

from __future__ import annotations

import asyncio
import logging
from typing import Protocol

from app.map_state import state_patch_for_event
from app.mqtt_reporter import MqttCloudReporter
from app.reporter import CloudReporter
from app.workflow.graph import build_workflow_graph, make_initial_state
from traybot_protocol.models import LiveEvent, WorkOrder, WorkOrderStatus

logger = logging.getLogger(__name__)

STEP_INTERVAL = 7.0
INSTANT_NODE_DELAY = 5.0
NAV_POST_DELAY = 1.0
THINKING_CHAR_DELAY = 0.04

NAV_LERP_STEPS = 20
NAV_LERP_DELAY = STEP_INTERVAL / NAV_LERP_STEPS


class CloudReporterProtocol(Protocol):
    async def connect(self) -> None: ...
    async def close(self) -> None: ...
    async def publish_event(self, event: LiveEvent, task_id: str) -> None: ...
    async def publish_state(self, patch: dict) -> None: ...
    async def publish_workorder_progress(self, order_id: str, delivered_trays: int) -> None: ...
    async def publish_workorder_done(self, order_id: str, delivered_trays: int) -> None: ...
    async def wait_for_workorder(self) -> dict: ...


def _work_order_from_payload(payload: dict) -> WorkOrder:
    return WorkOrder(
        id=payload["id"],
        total_trays=payload["totalTrays"],
        delivered_trays=payload.get("deliveredTrays", 0),
        pickup=payload["pickup"],
        delivery=payload["delivery"],
        backpack_capacity=payload.get("backpackCapacity", 20),
        status=WorkOrderStatus.IN_PROGRESS,
    )


async def _animate_navigation(
    reporter: CloudReporterProtocol,
    patch: dict,
    task_id: str,
) -> None:
    move = patch.get("map", {}).get("move")
    if not move:
        await reporter.publish_state(patch)
        return

    from app.map_state import LANDMARKS

    start = LANDMARKS[move["from"]]
    end = LANDMARKS[move["to"]]
    for i in range(1, NAV_LERP_STEPS + 1):
        t = i / NAV_LERP_STEPS
        pos = {
            "x": start["x"] + (end["x"] - start["x"]) * t,
            "y": start["y"] + (end["y"] - start["y"]) * t,
        }
        frame = {
            "robot": patch["robot"],
            "map": {
                **patch["map"],
                "robotPos": pos,
            },
        }
        await reporter.publish_state(frame)
        await asyncio.sleep(NAV_LERP_DELAY)


async def _dwell_after_step(events: list[LiveEvent], *, had_navigation: bool) -> None:
    if had_navigation:
        await asyncio.sleep(NAV_POST_DELAY)
        return
    thinking_chars = sum(len(e.thinking or "") for e in events)
    thinking_elapsed = thinking_chars * THINKING_CHAR_DELAY
    dwell = max(INSTANT_NODE_DELAY - thinking_elapsed, 1.5)
    await asyncio.sleep(dwell)


async def run_workflow_on_cloud(reporter: CloudReporterProtocol, work_order: WorkOrder) -> None:
    app = build_workflow_graph()
    state = make_initial_state(work_order)
    task_id = work_order.id
    final_delivered = work_order.delivered_trays

    async for chunk in app.astream(state, stream_mode="updates"):
        for node_name, update in chunk.items():
            logger.info("执行节点: %s", node_name)
            events: list[LiveEvent] = update.get("events", [])
            had_navigation = False
            for event in events:
                await reporter.publish_event(event, task_id)
                patch = state_patch_for_event(
                    event.type,
                    event.title,
                    task_id,
                    nav_from=update.get("nav_from"),
                    active_route=event.active_route,
                )
                if patch.get("map", {}).get("move"):
                    had_navigation = True
                    await _animate_navigation(reporter, patch, task_id)
                else:
                    await reporter.publish_state(patch)

            if "work_order" in update:
                final_delivered = update["work_order"].delivered_trays
                if any(e.type.value == "put_shelf_success" for e in events):
                    await reporter.publish_workorder_progress(task_id, final_delivered)

            await _dwell_after_step(events, had_navigation=had_navigation)

    await reporter.publish_workorder_done(task_id, final_delivered)
    await reporter.publish_state({
        "robot": {"mode": "idle", "speed": 0.0, "taskId": None},
        "map": {"currentStepTitle": "", "activeRoute": None},
    })


def create_reporter(
    *,
    transport: str,
    robot_id: str,
    cloud_url: str,
    mqtt_broker: str,
    mqtt_port: int,
) -> CloudReporterProtocol:
    if transport == "mqtt":
        return MqttCloudReporter(mqtt_broker, robot_id=robot_id, port=mqtt_port)
    return CloudReporter(cloud_url, robot_id)


async def agent_loop(
    *,
    transport: str = "mqtt",
    robot_id: str = "TrayBot-01",
    cloud_url: str = "ws://127.0.0.1:8000/ws/agent",
    mqtt_broker: str = "127.0.0.1",
    mqtt_port: int = 1883,
) -> None:
    reporter = create_reporter(
        transport=transport,
        robot_id=robot_id,
        cloud_url=cloud_url,
        mqtt_broker=mqtt_broker,
        mqtt_port=mqtt_port,
    )
    await reporter.connect()
    try:
        while True:
            payload = await reporter.wait_for_workorder()
            wo = _work_order_from_payload(payload)
            logger.info("收到工单: %s", wo.id)
            await run_workflow_on_cloud(reporter, wo)
            logger.info("工单 %s 执行完毕，等待下一单", wo.id)
    finally:
        await reporter.close()
