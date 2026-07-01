# Java Backend 实现指南

本文档面向 **Java 开发者**，说明如何用 Java 替换当前 Python Backend（FastAPI），并与现有 **Agent（Python）**、**Dashboard（React）** 联调。

> 三方通信总览见 [3part_conn.md](./3part_conn.md)  
> Python 参考实现：`backend/app/`  
> 协议常量源码：`shared/traybot_protocol/`

---

## 1. 核心结论

| 问题 | 答案 |
|------|------|
| 线上协议要不要改？ | **不用改**。action 字符串、JSON 字段、camelCase 命名保持不变 |
| Java 能直接用 `shared/traybot_protocol` 吗？ | **不能**。它是 Python 包（Pydantic），Java 需自行实现等价 DTO |
| Agent / Dashboard 要不要改？ | **不用改**（只要 Java Backend 行为与协议对齐） |
| Java 要做什么？ | 实现与 `backend/app/hub.py` 等价的 **ConnectionHub + 工单池 + REST + WebSocket** |

```
Agent (Python)          Java Backend              Dashboard (React)
  shared/          ←→   自建 protocol 包    ←→    front/src/types
  不变                  新建实现                   不变
```

---

## 2. 架构位置

Java Backend 是 **唯一中枢**：

- Agent 通过 `WS /ws/agent` 上报
- Dashboard 通过 `WS /ws/dashboard` 订阅
- 运维/外部系统通过 `REST /api/workorders` 下工单

**Agent 与 Dashboard 不直连。**

![三方架构](./三方架构.png)

---

## 3. 线上协议（语言无关，必须严格遵守）

### 3.1 WebSocket Envelope

所有 WebSocket 消息统一格式：

```json
{
  "action": "<action 字符串>",
  "payload": { }
}
```

### 3.2 JSON 命名约定

- 线上 JSON 字段一律 **camelCase**（如 `totalTrays`、`deliveredTrays`、`activeRoute`）
- Java 类字段可用 camelCase，或通过 Jackson `@JsonProperty` 映射
- **禁止**向 Dashboard 发送 snake_case（如 `total_trays`），前端无法识别

### 3.3 时间格式

- `timestamp` 使用 **ISO8601 字符串**，如 `2026-06-29T10:23:45.000Z`
- 推荐 Java：`Instant.now().toString()` 或 `DateTimeFormatter.ISO_INSTANT`

---

## 4. Action 常量（Java Enum 对照）

建议在 Java 中定义三个枚举，字符串值必须与下表 **完全一致**。

### 4.1 Agent → Backend（`AgentAction`）

| 枚举名 | action 字符串 |
|--------|---------------|
| `HELLO` | `agent.hello` |
| `EVENT` | `agent.event` |
| `THINKING_DELTA` | `agent.thinking.delta` |
| `THINKING_DONE` | `agent.thinking.done` |
| `STATE` | `agent.state` |
| `WORKORDER_PROGRESS` | `agent.workorder.progress` |
| `WORKORDER_DONE` | `agent.workorder.done` |

### 4.2 Backend → Dashboard（`DashboardAction`）

| 枚举名 | action 字符串 |
|--------|---------------|
| `SNAPSHOT` | `snapshot` |
| `EVENT_CREATED` | `event.created` |
| `THINKING_DELTA` | `event.thinking.delta` |
| `THINKING_DONE` | `event.thinking.done` |
| `FEED_CLEAR` | `feed.clear` |
| `STATE_PATCH` | `state.patch` |
| `WORKORDER_CREATED` | `workorder.created` |
| `WORKORDER_UPDATED` | `workorder.updated` |
| `WORKORDER_COMPLETED` | `workorder.completed` |
| `WORKORDER_STARTED` | `workorder.started` |
| `PONG` | `pong` |

### 4.3 Backend → Agent（`CloudToAgentAction`）

| 枚举名 | action 字符串 |
|--------|---------------|
| `WORKORDER_ASSIGN` | `workorder.assign` |
| `PING` | `ping` |

### 4.4 Dashboard → Backend

| action 字符串 | 说明 |
|---------------|------|
| `ping` | 心跳，Backend 回复 `pong` |

---

## 5. 数据模型（Java DTO 对照）

以下 JSON 形状必须与 Python / TypeScript 一致。Python 源码见 `shared/traybot_protocol/models.py`，前端见 `front/src/types/index.ts`。

### 5.1 WorkOrder（工单）

**REST 响应 / WebSocket payload / snapshot 中使用：**

```json
{
  "id": "WO-20260629-001",
  "totalTrays": 25,
  "deliveredTrays": 20,
  "pickup": "取料货架 A-01",
  "delivery": "送料货架 B-09",
  "status": "pending"
}
```

`status` 枚举：`pending` | `in_progress` | `completed`

**POST 创建工单 body（camelCase）：**

```json
{
  "id": "WO-20260629-001",
  "totalTrays": 25,
  "pickup": "取料货架 A-01",
  "delivery": "送料货架 B-09",
  "backpackCapacity": 20
}
```

**分派 Agent（`workorder.assign`）payload：**

```json
{
  "id": "WO-20260629-001",
  "totalTrays": 25,
  "deliveredTrays": 0,
  "pickup": "取料货架 A-01",
  "delivery": "送料货架 B-09",
  "backpackCapacity": 20
}
```

### 5.2 LiveEvent（图文直播）

```json
{
  "id": "evt-abc123def456",
  "type": "grab_success",
  "title": "抓取成功",
  "description": "夹爪抓取完成，本轮 20 盘已稳定",
  "thinking": "可选，Thinking 全文",
  "activeRoute": "home-pickup",
  "timestamp": "2026-06-29T10:23:45.000Z",
  "visible": true
}
```

`type` 枚举（`LiveEventType`）：

| 值 | 含义 |
|----|------|
| `order_received` | 收到工单（通常 `visible=false`） |
| `nav_to_pickup` | 前往取料货架 |
| `arrived_pickup` | 抵达取料货架 |
| `target_locked` | 目标盘已锁定 |
| `grab_success` | 抓取成功 |
| `put_backpack` | 入包 |
| `nav_to_delivery` | 前往送料货架 |
| `arrived_delivery` | 抵达送料货架 |
| `taking_out` | 从背包取出 |
| `put_shelf_success` | 放架成功 |
| `batch_decision` | 批次决策 |
| `return_home` | 返回 HOME |

`activeRoute` 可选：`home-pickup` | `pickup-delivery` | `delivery-home` | `delivery-pickup`

> Agent 上报 `agent.event` 时额外带 `taskId`（工单号），Backend 转发给 Dashboard 时 **应去掉** `taskId`。

### 5.3 Thinking 流式

**Agent → Backend（逐字）：**

```json
{
  "action": "agent.thinking.delta",
  "payload": {
    "eventId": "evt-abc123",
    "delta": "定"
  }
}
```

**Backend → Dashboard（必须带完整 thinking）：**

```json
{
  "action": "event.thinking.delta",
  "payload": {
    "eventId": "evt-abc123",
    "delta": "定",
    "thinking": "定"
  }
}
```

**结束：**

```json
{ "action": "event.thinking.done", "payload": { "eventId": "evt-abc123" } }
```

Backend 需在服务端累积 `_pending_thinking[eventId]`，每帧附带当前完整 `thinking` 字符串。

### 5.4 状态增量（state.patch）

```json
{
  "action": "state.patch",
  "payload": {
    "robot": {
      "mode": "navigating",
      "speed": 0.35,
      "taskId": "WO-20260629-001"
    },
    "map": {
      "robotPos": { "x": 120, "y": 80 },
      "currentStepTitle": "正在前往取料货架",
      "activeRoute": "home-pickup"
    }
  }
}
```

`robot.mode` 枚举：`idle` | `navigating` | `operating` | `charging` | `error`

### 5.5 连接快照（snapshot）

Dashboard 连接 `/ws/dashboard` 成功后 **立即**推送：

```json
{
  "action": "snapshot",
  "payload": {
    "liveEvents": [],
    "workOrders": [],
    "robotStatus": {
      "name": "TrayBot-01",
      "mode": "idle",
      "battery": 78,
      "batteryVoltage": 48.2,
      "cpuTemp": 52,
      "speed": 0,
      "uptime": "00:00:00",
      "taskId": null,
      "networkLatency": 12,
      "signalStrength": 92,
      "joints": [
        { "id": "j1", "name": "基座", "temperature": 38, "angle": 45.2 }
      ]
    },
    "mapState": {
      "robotPos": { "x": 80, "y": 320 },
      "currentStepTitle": "",
      "activeRoute": null
    }
  }
}
```

---

## 6. REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/workorders` | 返回 `{ "workOrders": [...] }` |
| `POST` | `/api/workorders` | 创建工单，201；重复 id → 409 |

**GET /health 响应：**

```json
{
  "status": "ok",
  "agent_connected": true,
  "dashboard_clients": 1
}
```

**POST 创建后逻辑：**

- 若新工单升为 `in_progress` → 广播 `workorder.started` + 向 Agent 发 `workorder.assign`
- 若为 `pending` → 广播 `workorder.created`

---

## 7. WebSocket 端点

| 路径 | 角色 | 说明 |
|------|------|------|
| `/ws/agent` | Agent 连接 | 接收 Agent 上报；下发 `workorder.assign` |
| `/ws/dashboard` | Dashboard 连接 | 推送 snapshot 及所有实时更新；接收 `ping` |

### 7.1 Agent 连接规则

参考 Python `ConnectionHub.register_agent()`：

1. **仅允许 1 个 Agent**；新连接 close 旧连接（建议 code `4000`，reason `replaced by new agent`）
2. 连接后若 `_executingOrderId` 仍有执行中工单 → 重新发 `workorder.assign`
3. 否则若有 `in_progress` 工单 → 分派给 Agent
4. Agent 断开 → 清空 `_executingOrderId`

### 7.2 Dashboard 连接规则

1. 连接成功 → 立即发 `snapshot`
2. 支持多个 Dashboard 客户端（广播）
3. 收到 `{ "action": "ping" }` → 回复 `{ "action": "pong", "payload": {} }`

---

## 8. ConnectionHub 消息转发（核心逻辑）

Java 必须实现与 `backend/app/hub.py` → `handle_agent_message()` 等价的行为。

| 收到 Agent action | Backend 处理 | 转发 Dashboard |
|-------------------|-------------|----------------|
| `agent.hello` | 记录 robotId，不转发 | — |
| `agent.event` | 校验 taskId；`visible=false` 不写 feed | `event.created`（visible 时） |
| `agent.thinking.delta` | 累积 thinking 全文 | `event.thinking.delta`（含 `thinking`） |
| `agent.thinking.done` | 清除 pending | `event.thinking.done` |
| `agent.state` | patch robot / map | `state.patch` |
| `agent.workorder.progress` | 更新工单进度（忽略非当前工单） | `workorder.updated` |
| `agent.workorder.done` | 完成工单、清空 liveEvents | `workorder.completed` + `feed.clear` + 可能 `workorder.started` |

**`agent.event` 额外处理（即使不广播也要做）：**

- 用 `title` 更新 `mapState.currentStepTitle`
- 用 `taskId` 更新 `robotStatus.taskId`、`mode=operating`

**`agent.workorder.done` 完整流程：**

```
1. _executingOrderId = null
2. liveEvents 清空
3. 工单标记 completed
4. 广播 workorder.completed
5. 广播 feed.clear
6. 若队列有 pending → 升为 in_progress
7. 广播 workorder.started
8. 向 Agent 发 workorder.assign（下一单）
```

**安全校验：**

- 若 `_executingOrderId` 已设置，忽略其他工单的 `agent.event` / `progress` / `done`

---

## 9. 工单池规则（WorkOrderStore）

参考 `backend/app/work_orders.py`。

| 规则 | 说明 |
|------|------|
| 初始为空 | 不预置 Mock 数据 |
| 创建工单 | 无 `in_progress` → 新单自动 `in_progress`；否则 `pending` |
| 全局唯一进行中 | `normalizeQueue()` 保证最多 1 条 `in_progress` |
| 完成工单 | `complete()` → FIFO 取下一条 `pending` 升为 `in_progress` |
| 重复 id | `create()` 抛错 → REST 返回 409 |

---

## 10. Dashboard 运行时状态（DashboardState）

参考 `backend/app/state.py`。

| 字段 | 说明 |
|------|------|
| `liveEvents` | 图文直播列表，最多 **40** 条，按 `id` 去重 |
| `robot` | 机器人状态（默认值见 snapshot 示例） |
| `mapState` | 地图状态（`robotPos`、`currentStepTitle`、`activeRoute`） |

---

## 11. 建议 Java 工程结构

```
traybot-backend-java/
├── src/main/java/com/example/traybot/
│   ├── protocol/
│   │   ├── AgentAction.java          // enum
│   │   ├── DashboardAction.java      // enum
│   │   ├── CloudToAgentAction.java   // enum
│   │   ├── WsEnvelope.java           // { action, payload }
│   │   ├── WorkOrderDto.java
│   │   ├── LiveEventDto.java
│   │   ├── SnapshotPayload.java
│   │   └── StatePatchPayload.java
│   ├── hub/
│   │   └── ConnectionHub.java        // 对标 hub.py
│   ├── service/
│   │   ├── WorkOrderStore.java       // 对标 work_orders.py
│   │   └── DashboardState.java       // 对标 state.py
│   ├── websocket/
│   │   ├── AgentWebSocketHandler.java
│   │   └── DashboardWebSocketHandler.java
│   └── web/
│       ├── HealthController.java
│       └── WorkOrderController.java
```

技术栈建议（任选）：

- **Spring Boot 3** + `spring-boot-starter-websocket` + Jackson
- 或 **Netty** + Jackson（更轻量）

---

## 12. Java 实现要点

### 12.1 Jackson 示例

```java
public record WorkOrderDto(
    String id,
    int totalTrays,
    int deliveredTrays,
    String pickup,
    String delivery,
    WorkOrderStatus status
) {}

public enum WorkOrderStatus {
    @JsonProperty("pending") PENDING,
    @JsonProperty("in_progress") IN_PROGRESS,
    @JsonProperty("completed") COMPLETED
}
```

或使用 `@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)` 保证序列化为 camelCase。

### 12.2 WebSocket 消息发送

```java
public void send(WebSocketSession session, DashboardAction action, Object payload) throws IOException {
    var envelope = Map.of("action", action.getValue(), "payload", payload);
    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(envelope)));
}
```

### 12.3 广播

维护 `Set<WebSocketSession> dashboardClients`，遍历发送；失败则移除 dead session。

### 12.4 CORS

Python Backend 允许所有 Origin（联调用）。Spring 需配置 CORS 或通过 Vite 代理访问。

---

## 13. 与现有 Python 组件联调

替换 Backend 后，Agent 与 Dashboard **无需修改**，按以下步骤验证：

```bash
# 1. 启动 Java Backend（:8000，路径与 Python 版一致）

# 2. 启动 Dashboard
cd front && npm run dev   # VITE_USE_MOCK=false

# 3. 启动 Agent
cd agent && python -m app.main run-cloud --cloud-url ws://127.0.0.1:8000/ws/agent

# 4. 下工单
curl -X POST http://127.0.0.1:8000/api/workorders \
  -H 'Content-Type: application/json' \
  -d '{"id":"WO-001","totalTrays":25,"pickup":"取料货架 A-01","delivery":"送料货架 B-09","backpackCapacity":20}'
```

**验收清单：**

- [ ] Dashboard 连接后收到 `snapshot`
- [ ] 下工单后 Agent 收到 `workorder.assign`
- [ ] 图文直播逐步出现 `event.created`
- [ ] Thinking 文字无重复、无乱码
- [ ] 地图 `state.patch` 机器人位置移动
- [ ] 多批次工单（25 盘 / 容量 20）第二批路线为 `delivery-pickup`
- [ ] 工单完成后 `feed.clear`，下一单自动 `workorder.started`

---

## 14. 不需要 Java 实现的部分

以下能力当前 **不在 Backend 协议内**，Java 版可暂不实现：

| 能力 | 说明 |
|------|------|
| LangGraph 工作流 | 在 Agent 端，Backend 不执行 |
| 摄像头流 | Dashboard 本地 MP4，不走 WebSocket |
| 移动控制面板 | Dashboard 本地 UI |
| 工单 DB 持久化 | Python 版也是内存存储，可按需扩展 |

---

## 15. 长期演进：多语言协议同步

若团队长期维护 Python Agent + Java Backend + TypeScript Front，建议：

1. 以 **`doc/3part_conn.md` + 本文档** 为协议权威说明
2. 可选：在 `shared/schema/` 增加 **JSON Schema**，各端 codegen
3. **`shared/traybot_protocol`（Python）不必删除**，Agent 继续使用
4. Java 侧维护 `protocol/` 包，协议变更时同步更新三端

**原则：改协议先改文档，再改 Python shared + Java DTO + TS types，最后改 Hub 行为。**

---

## 16. Python 参考文件索引

| 文件 | Java 应对标 |
|------|-------------|
| `shared/traybot_protocol/messages.py` | `AgentAction` / `DashboardAction` 枚举 |
| `shared/traybot_protocol/models.py` | DTO 类 |
| `backend/app/hub.py` | `ConnectionHub` |
| `backend/app/work_orders.py` | `WorkOrderStore` |
| `backend/app/state.py` | `DashboardState` |
| `backend/app/server.py` | REST + WebSocket 路由 |
| `front/src/types/index.ts` | Dashboard 期望的 JSON 形状（联调验收依据） |
