# MQTT 服务部署与使用

TrayBot **默认联调架构**：

```
Dashboard ──WebSocket /ws/dashboard──▶ Backend ──MQTT──▶ Agent
REST POST /api/workorders ──────────▶ Backend
```

- **Agent ↔ Backend**：MQTT（对齐异构平台 `thing/product/{type}/{sn}/service|osd`）
- **Dashboard ↔ Backend**：WebSocket（浏览器侧不改）
- **工单创建**：REST `POST /api/workorders`（不变）

协议字段见 [3part_conn.md](./3part_conn.md)。

---

## 1. Topic 约定

| Topic | 方向 | 说明 |
|-------|------|------|
| `thing/product/traybot/{robotId}/osd` | Agent → Backend | 事件、Thinking、状态、工单进度 |
| `thing/product/traybot/{robotId}/service` | Backend → Agent | 工单分派、ping |

Payload 与 WebSocket 相同：

```json
{ "action": "agent.event", "payload": { } }
```

源码：`shared/traybot_protocol/mqtt_topics.py`

---

## 2. 快速部署 Broker（Docker）

```bash
mkdir -p ~/mqtt/{config,data,log}

cat > ~/mqtt/config/mosquitto.conf << 'EOF'
listener 1883
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log
log_type all
EOF

docker run -d \
  --name traybot-mqtt \
  --restart unless-stopped \
  -p 1883:1883 \
  -v ~/mqtt/config/mosquitto.conf:/mosquitto/config/mosquitto.conf \
  -v ~/mqtt/data:/mosquitto/data \
  -v ~/mqtt/log:/mosquitto/log \
  eclipse-mosquitto:2
```

开发环境最简启动（无持久化）：

```bash
docker run -d --name traybot-mqtt -p 1883:1883 eclipse-mosquitto:2
```

---

## 3. 三端联调（MQTT 模式）

```bash
# 0. Broker（见上）

# 1. Backend（默认 TRAYBOT_MQTT_ENABLED=true）
cd backend && source .venv/bin/activate && ./run_server.sh

# 2. Agent
cd agent && source .venv/bin/activate
python -m app.main run-cloud
# 可选：--mqtt-broker 127.0.0.1 --mqtt-port 1883 --robot-id TrayBot-01

# 3. Dashboard
cd front && npm run dev   # VITE_USE_MOCK=false

# 4. 下工单
curl -X POST http://127.0.0.1:8000/api/workorders \
  -H 'Content-Type: application/json' \
  -d '{"id":"WO-MQTT-001","totalTrays":25,"pickup":"取料货架 A-01","delivery":"送料货架 B-09"}'

# 5. 健康检查
curl http://127.0.0.1:8000/health
# agent_connected / mqtt_bridge_connected 应为 true
```

### Backend 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `TRAYBOT_MQTT_ENABLED` | `true` | 关闭则仅 Legacy WS Agent |
| `TRAYBOT_MQTT_BROKER` | `127.0.0.1` | Broker 地址 |
| `TRAYBOT_MQTT_PORT` | `1883` | 端口 |

### Agent CLI

| 参数 | 默认 | 说明 |
|------|------|------|
| `--transport` | `mqtt` | `ws` 为 Legacy WebSocket |
| `--mqtt-broker` | `127.0.0.1` | |
| `--mqtt-port` | `1883` | |
| `--cloud-url` | `ws://127.0.0.1:8000/ws/agent` | 仅 `--transport ws` |

---

## 4. 命令行监听（调试）

```bash
# 订阅所有 TrayBot 上行
mosquitto_sub -h 127.0.0.1 -t "thing/product/traybot/#" -v

# 模拟 Backend 下发工单（需 Agent 已订阅 service topic）
mosquitto_pub -h 127.0.0.1 \
  -t "thing/product/traybot/TrayBot-01/service" \
  -m '{"action":"workorder.assign","payload":{"id":"WO-TEST","totalTrays":10,"pickup":"A","delivery":"B","backpackCapacity":20}}'
```

---

## 5. Legacy WebSocket 回退

无 Broker 或本地调试时可回退：

```bash
TRAYBOT_MQTT_ENABLED=false ./run_server.sh
python -m app.main run-cloud --transport ws
```

---

## 6. 生产环境

- 禁用 `allow_anonymous`，配置用户名密码或 TLS
- Broker 与 Backend 同 VPC 或专线
- Dashboard 仍走 Backend WebSocket，**不直连 MQTT**

详见下文 Mosquitto 鉴权配置（原 §7）与 [for_java_backent.md](./for_java_backent.md)（Java Backend 对接参考）。

---

## 7. 启用用户名密码（生产）

```bash
docker exec -it traybot-mqtt mosquitto_passwd -c /mosquitto/config/passwd traybot

# mosquitto.conf:
# allow_anonymous false
# password_file /mosquitto/config/passwd
```

---

## 8. 常见问题

| 现象 | 处理 |
|------|------|
| `agent_connected: false` | 确认 Broker 运行；Agent 已 `run-cloud`；`/health` 中 `mqtt_bridge_connected` |
| Backend 启动报 MQTT 失败 | Broker 未就绪；或设 `TRAYBOT_MQTT_ENABLED=false` 用 WS |
| 工单不分派 | Agent 需先发 `agent.hello`；检查 service topic 与 robotId 一致 |
| Dashboard 无事件 | Dashboard 走 WS，与 MQTT 无关；查 Backend 日志与 `/ws/dashboard` |

---

## 9. 参考

- [Eclipse Mosquitto](https://mosquitto.org/documentation/)
- TrayBot 三方协议：[3part_conn.md](./3part_conn.md)
- Java Backend：[for_java_backent.md](./for_java_backent.md)
