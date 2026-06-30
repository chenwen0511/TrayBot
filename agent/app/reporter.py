"""向云端 backend 上报事件与状态。"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import websockets
from websockets.asyncio.client import ClientConnection

from traybot_protocol.messages import AgentAction
from traybot_protocol.models import LiveEvent

logger = logging.getLogger(__name__)

THINKING_CHAR_DELAY = 0.04


class CloudReporter:
    def __init__(self, url: str, robot_id: str = "TrayBot-01") -> None:
        self.url = url
        self.robot_id = robot_id
        self._ws: ClientConnection | None = None

    async def connect(self) -> None:
        self._ws = await websockets.connect(self.url)
        await self._send(AgentAction.HELLO, {"robotId": self.robot_id, "version": "0.1.0"})
        logger.info("已连接云端 %s", self.url)

    async def close(self) -> None:
        if self._ws:
            await self._ws.close()
            self._ws = None

    async def _send(self, action: AgentAction | str, payload: dict[str, Any]) -> None:
        if not self._ws:
            raise RuntimeError("未连接云端")
        await self._ws.send(json.dumps({"action": str(action), "payload": payload}, ensure_ascii=False))

    async def publish_event(self, event: LiveEvent, task_id: str) -> None:
        payload = event.to_feed_dict()
        thinking = payload.pop("thinking", None)
        payload["taskId"] = task_id
        await self._send(AgentAction.EVENT, payload)
        if thinking:
            for char in thinking:
                await self._send(
                    AgentAction.THINKING_DELTA,
                    {"eventId": event.id, "delta": char},
                )
                await asyncio.sleep(THINKING_CHAR_DELAY)
            await self._send(AgentAction.THINKING_DONE, {"eventId": event.id})

    async def publish_state(self, patch: dict[str, Any]) -> None:
        await self._send(AgentAction.STATE, patch)

    async def publish_workorder_progress(self, order_id: str, delivered_trays: int) -> None:
        await self._send(
            AgentAction.WORKORDER_PROGRESS,
            {"id": order_id, "deliveredTrays": delivered_trays},
        )

    async def publish_workorder_done(self, order_id: str, delivered_trays: int) -> None:
        await self._send(
            AgentAction.WORKORDER_DONE,
            {"id": order_id, "deliveredTrays": delivered_trays},
        )

    async def wait_for_workorder(self) -> dict:
        if not self._ws:
            raise RuntimeError("未连接云端")
        while True:
            raw = await self._ws.recv()
            msg = json.loads(raw)
            if msg.get("action") == "workorder.assign":
                return msg["payload"]
            if msg.get("action") == "ping":
                await self._send("pong", {})
