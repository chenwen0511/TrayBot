"""WebSocket 连接管理与消息转发。"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

from app.state import DashboardState
from app.work_orders import WorkOrderStore
from traybot_protocol.messages import AgentAction, CloudToAgentAction, DashboardAction

logger = logging.getLogger(__name__)


class ConnectionHub:
    def __init__(self) -> None:
        self.dashboard_clients: set[WebSocket] = set()
        self.agent_ws: WebSocket | None = None
        self.agent_connected = asyncio.Event()
        self.work_orders = WorkOrderStore()
        self.dashboard_state = DashboardState()
        self._pending_thinking: dict[str, str] = {}
        self._executing_order_id: str | None = None

    async def register_dashboard(self, ws: WebSocket) -> None:
        await ws.accept()
        self.dashboard_clients.add(ws)
        await self._send(ws, DashboardAction.SNAPSHOT, self.dashboard_state.snapshot(
            self.work_orders.to_feed_list()
        ))

    def unregister_dashboard(self, ws: WebSocket) -> None:
        self.dashboard_clients.discard(ws)

    async def register_agent(self, ws: WebSocket) -> None:
        if self.agent_ws is not None and self.agent_ws is not ws:
            try:
                await self.agent_ws.close(code=4000, reason="replaced by new agent")
            except Exception:
                pass
        await ws.accept()
        self.agent_ws = ws
        self.agent_connected.set()
        logger.info("Agent 已连接")

        # 仅在没有正在执行的工单时分派；重连时继续分派当前执行中的工单
        if self._executing_order_id:
            current = self.work_orders.get_by_id(self._executing_order_id)
            if current and current.status.value == "in_progress":
                await self._send_agent(
                    CloudToAgentAction.WORKORDER_ASSIGN,
                    self.work_orders.assign_payload(current),
                )
                return
            self._executing_order_id = None

        current = self.work_orders.get_in_progress()
        if current:
            await self._assign_to_agent(current)

    def unregister_agent(self, ws: WebSocket) -> None:
        if self.agent_ws is ws:
            self.agent_ws = None
            self.agent_connected.clear()
            self._executing_order_id = None
            logger.info("Agent 已断开")

    async def _assign_to_agent(self, order) -> None:
        if not self.agent_ws:
            return
        if self._executing_order_id is not None:
            logger.warning("Agent 正在执行 %s，跳过分派 %s", self._executing_order_id, order.id)
            return
        self._executing_order_id = order.id
        logger.info("分派工单给 Agent: %s", order.id)
        await self._send_agent(
            CloudToAgentAction.WORKORDER_ASSIGN,
            self.work_orders.assign_payload(order),
        )

    async def broadcast_dashboard(self, action: DashboardAction | str, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self.dashboard_clients:
            try:
                await self._send(ws, action, payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.unregister_dashboard(ws)

    async def _send(self, ws: WebSocket, action: DashboardAction | str, payload: dict[str, Any]) -> None:
        await ws.send_json({"action": str(action), "payload": payload})

    async def _send_agent(self, action: CloudToAgentAction | str, payload: dict[str, Any]) -> None:
        if not self.agent_ws:
            return
        await self.agent_ws.send_json({"action": str(action), "payload": payload})

    async def handle_agent_message(self, msg: dict[str, Any]) -> None:
        action = msg.get("action")
        payload = msg.get("payload", {})

        if action == AgentAction.HELLO:
            logger.info("Agent 注册: %s", payload.get("robotId"))
            return

        if action == AgentAction.EVENT:
            task_id = payload.get("taskId")
            if self._executing_order_id and task_id and task_id != self._executing_order_id:
                logger.warning("忽略非当前工单事件: %s (executing=%s)", task_id, self._executing_order_id)
                return
            visible = payload.get("visible", True)
            event = {k: v for k, v in payload.items() if k != "taskId"}
            if visible:
                self.dashboard_state.append_event(event)
                await self.broadcast_dashboard(DashboardAction.EVENT_CREATED, event)
            title = payload.get("title", "")
            if title:
                self.dashboard_state.patch_map({"currentStepTitle": title})
            task_id = payload.get("taskId")
            if task_id:
                self.dashboard_state.patch_robot({"taskId": task_id, "mode": "operating"})
            return

        if action == AgentAction.THINKING_DELTA:
            event_id = payload["eventId"]
            delta = payload["delta"]
            self._pending_thinking[event_id] = self._pending_thinking.get(event_id, "") + delta
            full = self._pending_thinking[event_id]
            for evt in self.dashboard_state.live_events:
                if evt["id"] == event_id:
                    evt["thinking"] = full
                    break
            await self.broadcast_dashboard(
                DashboardAction.THINKING_DELTA,
                {"eventId": event_id, "delta": delta, "thinking": full},
            )
            return

        if action == AgentAction.THINKING_DONE:
            event_id = payload["eventId"]
            self._pending_thinking.pop(event_id, None)
            await self.broadcast_dashboard(DashboardAction.THINKING_DONE, payload)
            return

        if action == AgentAction.STATE:
            robot_patch = payload.get("robot")
            map_patch = payload.get("map")
            if robot_patch:
                self.dashboard_state.patch_robot(robot_patch)
            if map_patch:
                self.dashboard_state.patch_map(map_patch)
            await self.broadcast_dashboard(DashboardAction.STATE_PATCH, payload)
            return

        if action == AgentAction.WORKORDER_PROGRESS:
            order_id = payload["id"]
            if self._executing_order_id and order_id != self._executing_order_id:
                return
            updated = self.work_orders.update_progress(order_id, payload["deliveredTrays"])
            if updated:
                await self.broadcast_dashboard(
                    DashboardAction.WORKORDER_UPDATED,
                    updated.to_feed_dict(),
                )
            return

        if action == AgentAction.WORKORDER_DONE:
            order_id = payload["id"]
            if self._executing_order_id and order_id != self._executing_order_id:
                return
            self._executing_order_id = None
            self.dashboard_state.live_events = []
            completed, started = self.work_orders.complete(order_id, payload["deliveredTrays"])
            if completed:
                await self.broadcast_dashboard(
                    DashboardAction.WORKORDER_COMPLETED,
                    completed.to_feed_dict(),
                )
            await self.broadcast_dashboard(DashboardAction.FEED_CLEAR, {})
            if started and started.id != order_id:
                await self.broadcast_dashboard(
                    DashboardAction.WORKORDER_STARTED,
                    started.to_feed_dict(),
                )
                await self._assign_to_agent(started)
            return

        logger.warning("未知 Agent 消息: %s", action)


hub = ConnectionHub()
