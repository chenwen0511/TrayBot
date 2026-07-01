"""pytest 配置：测试环境禁用 MQTT Bridge。"""

import os

os.environ.setdefault("TRAYBOT_MQTT_ENABLED", "false")
