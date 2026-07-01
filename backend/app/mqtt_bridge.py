"""Backend MQTT 桥接：订阅 Agent osd，发布 service，转发至 ConnectionHub。"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING, Any

from aiomqtt import Client
from traybot_protocol.messages import CloudToAgentAction
from traybot_protocol.mqtt_topics import (
    DEFAULT_PRODUCT_TYPE,
    osd_subscription,
    robot_id_from_osd_topic,
    service_topic,
)

if TYPE_CHECKING:
    from app.hub import ConnectionHub

logger = logging.getLogger(__name__)


class MqttBridge:
    def __init__(
        self,
        hub: ConnectionHub,
        broker: str = "127.0.0.1",
        port: int = 1883,
        product_type: str = DEFAULT_PRODUCT_TYPE,
    ) -> None:
        self._hub = hub
        self.broker = broker
        self.port = port
        self.product_type = product_type
        self._client: Client | None = None
        self._task: asyncio.Task | None = None
        self.connected = False

    async def start(self) -> None:
        self._client = Client(self.broker, self.port)
        await self._client.__aenter__()
        await self._client.subscribe(osd_subscription(self.product_type))
        self._task = asyncio.create_task(self._loop())
        self.connected = True
        logger.info("MQTT Bridge 已连接 %s:%s，订阅 %s", self.broker, self.port, osd_subscription(self.product_type))

    async def stop(self) -> None:
        self.connected = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        if self._client:
            await self._client.__aexit__(None, None, None)
            self._client = None

    async def publish_service(
        self,
        robot_id: str,
        action: CloudToAgentAction | str,
        payload: dict[str, Any],
    ) -> None:
        if not self._client:
            raise RuntimeError("MQTT Bridge 未启动")
        topic = service_topic(self.product_type, robot_id)
        body = json.dumps({"action": str(action), "payload": payload}, ensure_ascii=False)
        await self._client.publish(topic, body, qos=1)
        logger.info("MQTT 下发 %s → %s", action, topic)

    async def _loop(self) -> None:
        assert self._client is not None
        async for message in self._client.messages:
            robot_id = robot_id_from_osd_topic(str(message.topic))
            if not robot_id:
                continue
            try:
                envelope = json.loads(message.payload.decode())
            except (json.JSONDecodeError, UnicodeDecodeError):
                logger.warning("忽略非法 MQTT 消息 topic=%s", message.topic)
                continue
            if robot_id not in self._hub._mqtt_robots:
                self._hub._mqtt_robots.add(robot_id)
            await self._hub.handle_agent_message(envelope)
