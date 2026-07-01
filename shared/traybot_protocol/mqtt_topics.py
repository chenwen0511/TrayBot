"""MQTT Topic 约定（对齐异构多机平台 thing/product/{type}/{sn}/service|osd）。"""

from __future__ import annotations

DEFAULT_PRODUCT_TYPE = "traybot"


def service_topic(product_type: str, robot_id: str) -> str:
    """Backend → Agent 下行（任务分派、控制）。"""
    return f"thing/product/{product_type}/{robot_id}/service"


def osd_topic(product_type: str, robot_id: str) -> str:
    """Agent → Backend 上行（事件、状态、Thinking）。"""
    return f"thing/product/{product_type}/{robot_id}/osd"


def osd_subscription(product_type: str = DEFAULT_PRODUCT_TYPE) -> str:
    """Backend 订阅所有机器人上行。"""
    return f"thing/product/{product_type}/+/osd"


def robot_id_from_osd_topic(topic: str) -> str | None:
    """从 `thing/product/traybot/TrayBot-01/osd` 解析 robot_id。"""
    parts = topic.split("/")
    if len(parts) >= 5 and parts[0] == "thing" and parts[1] == "product" and parts[-1] == "osd":
        return parts[3]
    return None
