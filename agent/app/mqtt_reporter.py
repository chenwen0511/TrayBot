"""经 MQTT 向云端 Backend 上报（Agent ↔ Backend 混合架构）。"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from aiomqtt import Client

from traybot_protocol.messages import AgentAction, CloudToAgentAction
from traybot_protocol.models import LiveEvent
from traybot_protocol.mqtt_topics import DEFAULT_PRODUCT_TYPE, osd_topic, service_topic

logger = logging.getLogger(__name__)

THINKING_CHAR_DELAY = 0.04


class MqttCloudReporter:
    def __init__(
        self,
        broker: str,
        robot_id: str = "TrayBot-01",
        port: int = 1883,
        product_type: str = DEFAULT_PRODUCT_TYPE,
    ) -> None:
        self.broker = broker
        self.port = port
        self.robot_id = robot_id
        self.product_type = product_type
        self._client: Client | None = None
        self._assign_queue: asyncio.Queue[dict] = asyncio.Queue()
        self._reader_task: asyncio.Task | None = None

    async def connect(self) -> None:
        self._client = Client(self.broker, self.port)
        await self._client.__aenter__()
        await self._client.subscribe(service_topic(self.product_type, self.robot_id))
        self._reader_task = asyncio.create_task(self._read_loop())
        await self._send(AgentAction.HELLO, {"robotId": self.robot_id, "version": "0.1.0"})
        logger.info(
            "已连接 MQTT %s:%s topic=%s",
            self.broker,
            self.port,
            osd_topic(self.product_type, self.robot_id),
        )

    async def close(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
            self._reader_task = None
        if self._client:
            await self._client.__aexit__(None, None, None)
            self._client = None

    async def _read_loop(self) -> None:
        assert self._client is not None
        async for message in self._client.messages:
            try:
                envelope = json.loads(message.payload.decode())
            except (json.JSONDecodeError, UnicodeDecodeError):
                logger.warning("忽略非法 MQTT 消息")
                continue
            action = envelope.get("action")
            payload = envelope.get("payload", {})
            if action == CloudToAgentAction.WORKORDER_ASSIGN:
                await self._assign_queue.put(payload)
            elif action == CloudToAgentAction.PING:
                await self._send("pong", {})

    async def _send(self, action: AgentAction | str, payload: dict[str, Any]) -> None:
        if not self._client:
            raise RuntimeError("未连接 MQTT")
        topic = osd_topic(self.product_type, self.robot_id)
        body = json.dumps({"action": str(action), "payload": payload}, ensure_ascii=False)
        await self._client.publish(topic, body, qos=1)

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
        return await self._assign_queue.get()
