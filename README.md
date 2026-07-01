# TrayBot

端云分离的机器人监控与作业管理系统：端侧 Agent 执行 LangGraph 工作流，云端 Backend 管理工单；**Agent ↔ Backend 默认经 MQTT**，Dashboard ↔ Backend 仍用 WebSocket。

## 项目结构

```
TrayBot/
├── agent/          # 端侧 Agent（LangGraph 工作流，部署在机器人）
├── backend/        # 云端 Backend（工单 + MQTT Bridge + Dashboard WebSocket）
├── shared/         # 共享协议包 traybot_protocol
├── front/          # 前端监控界面 (React + Vite + Tailwind)
├── example/        # 示例视频等资源
└── doc/            # 文档
```

## 端云架构

```
agent（机器人端）  ──MQTT──▶  backend（云端）  ──WebSocket──▶  front（浏览器）
     LangGraph 执行              工单池 / MQTT Bridge / 转发        Dashboard
     硬件 / ROS（待接）           持久化（待接）
```

| 组件 | 部署 | 职责 |
|------|------|------|
| **agent** | 机器人 onboard | LangGraph 编排、步骤执行、Thinking 逐字上报、地图状态插值 |
| **backend** | 云服务器 | 工单队列（权威源）、MQTT Bridge（Agent）、Dashboard WebSocket Hub |
| **shared** | 两端依赖 | `LiveEvent`、`WorkOrder`、消息 action 常量、MQTT Topic 约定 |
| **front** | CDN / 静态托管 | 连接 `/ws/dashboard`，展示工单池与图文直播 |

### 数据流

```
Agent
  │  agent.hello / agent.event / agent.thinking.* / agent.state / agent.workorder.*
  ▼
Backend (ConnectionHub)
  │  snapshot / event.* / state.patch / workorder.* / feed.clear
  ▼
Front (DashboardSocketClient 单例)
```

**尚未接入**：真实 ROS/硬件、摄像头实时流后端、工单持久化 DB、LLM 真推理（Thinking 为预置文案逐字模拟）。

---

## 快速开始（三端联调）

**前置**：启动 MQTT Broker（见 [doc/mqtt.md](./doc/mqtt.md)）：

```bash
docker run -d --name traybot-mqtt -p 1883:1883 eclipse-mosquitto:2
```

```bash
# 终端 1 — 云端 backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
./run_server.sh          # http://0.0.0.0:8000（默认启用 MQTT Bridge）

# 终端 2 — 前端
cd front && npm install && npm run dev   # http://localhost:5173

# 终端 3 — 端侧 agent（模拟机器人，同时只允许一个实例）
cd agent && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.main run-cloud   # 默认 --transport mqtt
```

Legacy WebSocket 模式（无需 Broker）：`python -m app.main run-cloud --transport ws`

### 下工单

工单池**初始为空**，不预置 Mock 数据。通过 REST API 手动下发：

```bash
curl -X POST http://127.0.0.1:8000/api/workorders \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "WO-20260629-001",
    "totalTrays": 35,
    "pickup": "取料货架 A-03",
    "delivery": "送料货架 B-07",
    "backpackCapacity": 20
  }'

curl http://127.0.0.1:8000/api/workorders   # 查询工单列表
curl http://127.0.0.1:8000/health           # 健康检查
```

- 当前无进行中工单时，第一条自动变为 `in_progress` 并分派给 Agent
- 后续 curl 的工单进入 `pending` 排队
- 重复 `id` 返回 **409**

### 清理与重启

```bash
pkill -f "uvicorn app.server" || true
pkill -f "app.main run-cloud" || true
rm -f /tmp/traybot-agent.lock
```

---

## 前端

### 布局与功能模块

12 列 Grid 布局（`front/src/App.tsx`）：

| 区域 | 组件 | 功能 |
|------|------|------|
| 左 col-2 | `RobotStatusPanel` | 电量、CPU 温度、关节温度/角度、运行时长、移动控制 UI（**仅本地交互，未接后端**） |
| 中 col-7 | `CameraGrid` + `FloorMap` | 三路 D435i MP4 循环播放 + SVG 平面图导航 |
| 右 col-3 | `ResizableVerticalSplit` | 上：工单池；下：图文直播（**可拖拽分割线**） |

**已实现组件**：

| 组件 | 路径 | 说明 |
|------|------|------|
| `Header` | `components/Header.tsx` | 机器人名、信号、模式、实时标识 |
| `CameraGrid` | `components/CameraGrid.tsx` | 左手腕 / 头部 / 右手腕 video loop、全屏 |
| `FloorMap` | `components/FloorMap.tsx` | HOME / 取料 / 送料点、机器人脉冲、路线高亮 |
| `WorkOrderPool` | `components/WorkOrderPool.tsx` | 已完成置顶 / 进行中居中 / 排队底部，**自动滚到底部** |
| `LiveFeed` | `components/LiveFeed.tsx` | 图文直播、Thinking 展示、**自动滚到底部** |
| `EventSnapshot` | `components/EventSnapshot.tsx` | 按事件 type 渲染 SVG 配图（无 `snapshotUrl` 时 fallback） |
| `ResizableVerticalSplit` | `components/ResizableVerticalSplit.tsx` | 垂直可拖拽分割，默认比 0.38，minTop 120 / minBottom 160 |

### Mock 与联调模式

由 `front/src/hooks/useDashboard.ts` 统一切换：

| 环境变量 | 行为 |
|----------|------|
| `VITE_USE_MOCK=false`（`.env.development` 默认） | 连接 backend WebSocket 联调 |
| `VITE_USE_MOCK=true` 或未设为非 `false` | 纯 Mock 本地演示 |

```bash
# 纯 Mock 预览（无需 backend / agent）
VITE_USE_MOCK=true npm run dev
```

可选 `VITE_WS_URL` 覆盖 WebSocket 地址；否则自动推导为 `${ws|wss}://${host}/ws/dashboard`。

Vite 代理（`vite.config.ts`）：

- `/ws` → `http://127.0.0.1:8000`（ws: true）
- `/health` → backend

### WebSocket 消费（`useDashboardSocket.ts`）

- **全局单例** `DashboardSocketClient`，避免 StrictMode / HMR 产生双连接
- `subscribe()` 时清除旧 handler，防止 Thinking delta 重复追加
- 断线 **3s** 自动重连
- 事件按 `id` 去重，保留最近 **40** 条
- 未连接时 robot `mode` 强制显示 `idle`

### 工单池 UI 规则（`WorkOrderPool.tsx`）

| 区域 | 状态 | 样式 |
|------|------|------|
| 顶部 | `completed` | 灰色半透明 |
| 中间 | `in_progress`（全局仅 1 条） | 红色 + 进度条 |
| 底部 | `pending` | 绿色；队列最后一条标「新接到」，其余「排队中」 |

工单列表变化时自动 `scrollTo` 底部，保证最新工单可见。

前端 `normalizeWorkOrderQueue()` 与 backend 一致：全局最多 1 条 `in_progress`，多余强制改 `pending`。

### 图文直播（`LiveFeed.tsx`）

| 能力 | Mock 模式 | 联调模式 |
|------|-----------|----------|
| 事件来源 | `useMockDashboard` 每 7s 推一条 | WebSocket `event.created` |
| 配图 | `EventSnapshot` SVG | 同左（`snapshotUrl` 待后端对接） |
| Thinking | 本地 **40ms/字** 打字机动画 | 后端 `thinking.delta` 逐字推送，**直接渲染全文** |
| 滚动 | 新事件自动滚到底 | 同左 |
| 过滤 | `order_received` 不进 feed | backend 设 `visible: false` |

**Thinking 流式（联调）**：

1. Agent 发 `agent.event`（不含 thinking 全文）
2. 逐字发 `agent.thinking.delta` → backend 转发 `event.thinking.delta`（含完整 `thinking` 字段）
3. 发 `agent.thinking.done` → 关闭 streaming 光标
4. 仅**最新一条**事件显示 streaming 光标（`thinkingLiveId`）

收到 `workorder.started` 或 `feed.clear` 时清空图文直播列表。

### 地图

坐标与 Agent `map_state.py` 对齐：

- home: `(80, 320)`，pickup: `(200, 80)`，delivery: `(520, 80)`
- `activeRoute`：`home-pickup` | `pickup-delivery` | `delivery-home` | `delivery-pickup`
- 导航时 Agent 以 20 帧 / 7s 高频推送 `state.patch` 更新 `robotPos`

### Mock 专有行为（`mock/useMockDashboard.ts`）

| 常量 | 值 |
|------|-----|
| `EVENT_INTERVAL` | 7000 ms/步 |
| `CYCLE_COOLDOWN` | 60000 ms 后重跑 |
| 新工单注入 | 每 30s 随机 pending |
| 预置工单 | 2 completed + 1 in_progress + 2 pending |
| 多批次 | `buildWorkflow()` 循环至 totalTrays 送完 |

> **注意**：Mock 支持多批次循环；Agent 当前每工单仅执行**单批次** 11 步后即 `workorder.done`（见 Agent 章节）。

### 摄像头 Demo

摄像头为独立 MP4 循环，不走 WebSocket：

```bash
ffmpeg -y -i example/*.mp4 -t 120 -c:v libx264 -profile:v baseline \
  -pix_fmt yuv420p -movflags +faststart -an front/public/videos/camera-left.mp4
cp front/public/videos/camera-left.mp4 front/public/videos/camera-front.mp4
cp front/public/videos/camera-left.mp4 front/public/videos/camera-right.mp4
```

三路相机 ID：`left`（左手腕）、`front`（头部）、`right`（右手腕）。  
`front/public/videos/*.mp4` 在 `.gitignore` 中，需本地生成。

### 启动

```bash
cd front
npm install
npm run dev
```

浏览器访问 http://localhost:5173

---

## Agent（端侧 LangGraph）

部署在机器人 onboard 计算机，负责执行工作流并上报云端。

### 工作流节点（11 步线性 Graph）

```
__start__
  → order_received      ★ Thinking（visible=false，不进图文直播）
  → nav_to_pickup
  → arrived_pickup      ★ Thinking
  → target_locked
  → grab_success
  → put_backpack
  → nav_to_delivery
  → arrived_delivery
  → taking_out
  → put_shelf_success
  → return_home         ★ Thinking
  → __end__
```

节点序列定义于 `shared/traybot_protocol/models.py` → `NODE_SEQUENCE`。  
`THINKING_NODES`：`order_received`、`arrived_pickup`、`return_home`。

### 目录结构

```
agent/
├── app/
│   ├── workflow/       # LangGraph graph + nodes
│   ├── reporter.py     # CloudReporter — Legacy WebSocket 客户端
│   ├── mqtt_reporter.py # MqttCloudReporter — 默认 MQTT 上报
│   ├── runner.py       # 逐步执行 + 导航插值 + 工单循环
│   ├── map_state.py    # 事件 → 地图/机器人 state patch
│   └── main.py         # CLI + 文件锁
└── tests/
```

### 时序常量（`runner.py` + `reporter.py`）

| 常量 | 值 | 含义 |
|------|-----|------|
| `STEP_INTERVAL` | 7.0 s | 导航步骤总时长（与 Mock 对齐） |
| `NAV_LERP_STEPS` | 20 | 导航插值帧数 |
| `NAV_LERP_DELAY` | 0.35 s | 每帧间隔 |
| `NAV_POST_DELAY` | 1.0 s | 导航结束后额外停留 |
| `INSTANT_NODE_DELAY` | 5.0 s | 原地步骤基础停留 |
| 原地 dwell | `max(5.0 - chars×0.04, 1.5)` | 扣除 Thinking 时长，防刷屏 |
| `THINKING_CHAR_DELAY` | 0.04 s/字 | 逐字推送 Thinking |

### Thinking 上报流程（`CloudReporter.publish_event`）

1. 发 `agent.event`（payload **不含** thinking 全文）
2. 若有 thinking：逐字发 `agent.thinking.delta`（`{"eventId", "delta"}`）
3. 发 `agent.thinking.done`

### 云端执行循环（`agent_loop`）

1. 连接 MQTT Broker（或 Legacy `/ws/agent`），发 `agent.hello`（`robotId`、`version`）
2. 阻塞等待 `workorder.assign`
3. 执行 `run_workflow_on_cloud()` → 完成后发 `agent.workorder.done`
4. 循环等待下一单

**单批次限制**：每次分派跑完整 11 步一次；`put_shelf_success` 累加 `batch_size` 后直接完成工单。若 `totalTrays > backpackCapacity`，工单以部分送达标记完成（多批次循环待实现）。

### 文件锁（防多 Agent 并行）

- 路径：`/tmp/traybot-agent.lock`
- 机制：`fcntl.flock(LOCK_EX | LOCK_NB)`，`run-cloud` 启动时获取
- 已有实例 → 报错退出

### CLI

```bash
cd agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m app.main graph       # 打印 ASCII + Mermaid 流程图
python -m app.main run         # 本地离线执行
python -m app.main json        # 输出节点序列 + events JSON
python -m app.main run-cloud   # 连接云端执行并推送图文直播（默认）
./run_tests.sh
```

| 参数 | 默认 |
|------|------|
| `--transport` | `mqtt`（或 `ws` Legacy） |
| `--mqtt-broker` | `127.0.0.1` |
| `--mqtt-port` | `1883` |
| `--cloud-url` | `ws://127.0.0.1:8000/ws/agent`（仅 `--transport ws`） |
| `--robot-id` | `TrayBot-01` |

---

## Backend（云端服务）

FastAPI + MQTT Bridge + Dashboard WebSocket，不含 LangGraph。

环境变量（Agent MQTT Bridge）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `TRAYBOT_MQTT_ENABLED` | `true` | 是否启动 MQTT Bridge |
| `TRAYBOT_MQTT_BROKER` | `127.0.0.1` | Broker 地址 |
| `TRAYBOT_MQTT_PORT` | `1883` | Broker 端口 |

### REST 端点

| 路径 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查（`agent_connected`、`mqtt_bridge_connected` 等） |
| `/api/workorders` | GET | 返回 `{ "workOrders": [...] }` |
| `/api/workorders` | POST | 创建工单（201）；重复 id → 409 |

**POST body**（camelCase）：

```json
{
  "id": "WO-20260629-001",
  "totalTrays": 35,
  "pickup": "取料货架 A-03",
  "delivery": "送料货架 B-07",
  "backpackCapacity": 20
}
```

### 连接端点

| 路径 | 方向 | 说明 |
|------|------|------|
| MQTT `thing/product/traybot/{robotId}/osd` | Agent → Backend | 默认上行（事件、状态） |
| MQTT `thing/product/traybot/{robotId}/service` | Backend → Agent | 默认下行（工单分派） |
| `/ws/agent` | Agent → Backend | Legacy WebSocket（`--transport ws`） |
| `/ws/dashboard` | Dashboard → Backend | 前端订阅；Backend 推送实时更新 |

### 工单池规则（`work_orders.py`）

- 初始为空，仅通过 POST 下发
- 创建时若无 `in_progress` → 新工单自动升为 `in_progress`，否则 `pending`
- `normalize_queue()`：全局最多 1 条 `in_progress`
- `complete()`：标记 completed → FIFO 取下一条 pending 升为 `in_progress`
- POST 后：若 `in_progress` → 广播 `workorder.started` + 分派 Agent；否则广播 `workorder.created`

### ConnectionHub 行为（`hub.py`）

**Dashboard 连接时**：立即推送 `snapshot`（liveEvents、workOrders、robotStatus、mapState）。

**Agent 连接**：

- 仅允许一个 Agent；新连接 close 旧连接（code 4000）
- 重连时：若 `_executing_order_id` 仍在执行 → 重新 `workorder.assign` 同一单
- 否则分派当前 `in_progress` 工单

**Agent 消息转发**：

| Agent action | Dashboard action | 备注 |
|--------------|------------------|------|
| `agent.event` | `event.created` | `visible=false` 不写入 feed、不广播 |
| `agent.thinking.delta` | `event.thinking.delta` | payload 含完整 `thinking` 字段 |
| `agent.thinking.done` | `event.thinking.done` | |
| `agent.state` | `state.patch` | |
| `agent.workorder.progress` | `workorder.updated` | 忽略非当前执行工单 |
| `agent.workorder.done` | `workorder.completed` + `feed.clear` + 可能 `workorder.started` | 清空 live_events，自动分派下一单 |

**Agent 分派 payload**（`workorder.assign`）：

```json
{
  "id": "...",
  "totalTrays": 35,
  "deliveredTrays": 0,
  "pickup": "...",
  "delivery": "...",
  "backpackCapacity": 20
}
```

事件去重：`DashboardState.append_event()` 按 `id` 去重；最多保留 40 条。

### 目录结构

```
backend/
├── app/
│   ├── server.py       # FastAPI 入口
│   ├── hub.py          # ConnectionHub — 连接管理 + 消息转发
│   ├── work_orders.py  # WorkOrderStore — 工单池（权威源）
│   └── state.py        # DashboardState — 运行时快照
└── run_server.sh       # uvicorn --host 0.0.0.0 --port 8000 --reload
```

### 启动与测试

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
./run_server.sh
./run_tests.sh
```

---

## 共享协议（shared/traybot_protocol）

Agent 与 Backend 通过 editable install 依赖：

```
# agent/requirements.txt & backend/requirements.txt
-e ../shared
```

### 模型（`models.py`）

- `LiveEvent`：`id`, `type`, `title`, `description?`, `thinking?`, `timestamp`, `visible`
- `WorkOrder`：`id`, `total_trays`, `delivered_trays`, `pickup`, `delivery`, `backpack_capacity`, `status`
- `LiveEventType`：11 种（`order_received` … `return_home`）
- 前端类型另含 `batch_decision`（UI 支持，Agent 工作流尚未产出）

类型定义亦见 `front/src/types/index.ts`，对接时应保持一致。

### 消息 action（`messages.py`）

**Agent → Backend**（`AgentAction`）：

| action | 说明 |
|--------|------|
| `agent.hello` | 注册 |
| `agent.event` | 步骤事件 |
| `agent.thinking.delta` | Thinking 增量 |
| `agent.thinking.done` | Thinking 结束 |
| `agent.state` | 机器人/地图状态 |
| `agent.workorder.progress` | 工单进度 |
| `agent.workorder.done` | 工单完成 |

**Backend → Dashboard**（`DashboardAction`）：

| action | 说明 |
|--------|------|
| `snapshot` | 连接初始快照 |
| `event.created` | 新直播条目 |
| `event.thinking.delta` | Thinking 增量（含完整 `thinking`） |
| `event.thinking.done` | Thinking 结束 |
| `feed.clear` | 清空图文直播 |
| `state.patch` | 机器人/地图增量 |
| `workorder.created` | 新工单入队 |
| `workorder.updated` | 进度变更 |
| `workorder.completed` | 工单完成 |
| `workorder.started` | 下一条工单开始 |
| `pong` | 心跳响应 |

**Backend → Agent**（`CloudToAgentAction`）：

| action | 说明 |
|--------|------|
| `workorder.assign` | 分派工单 |
| `ping` | 心跳 |

**Envelope 统一格式**：

```json
{ "action": "<action>", "payload": { } }
```

---

## 前后端交互规范

### 数据模型

#### LiveEvent（图文直播条目）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✓ | 事件唯一 ID |
| `type` | LiveEventType | ✓ | 事件类型 |
| `title` | string | ✓ | 主标题 |
| `description` | string | | 说明文字 |
| `thinking` | string | | AI 推理文字，支持流式 |
| `snapshotUrl` | string | | 相机截图 URL（**待对接**） |
| `timestamp` | ISO8601 | ✓ | 事件发生时间 |
| `visible` | boolean | | 默认 `true`；`false` 时不进 feed |

**LiveEventType**：

| type | 含义 |
|------|------|
| `order_received` | 收到工单（不进 feed） |
| `nav_to_pickup` | 前往取料货架 |
| `arrived_pickup` | 抵达取料货架 |
| `target_locked` | 目标盘已锁定 |
| `grab_success` | 抓取成功 |
| `put_backpack` | 入包 |
| `nav_to_delivery` | 前往送料货架 |
| `arrived_delivery` | 抵达送料货架 |
| `taking_out` | 从背包取出 |
| `put_shelf_success` | 放架成功 |
| `batch_decision` | 批次决策（前端 UI 支持，Agent 未产出） |
| `return_home` | 返回 HOME |

#### WorkOrder（工单）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 工单号 |
| `totalTrays` | number | 总盘数 |
| `deliveredTrays` | number | 已送盘数 |
| `pickup` | string | 取料货架 |
| `delivery` | string | 送料货架 |
| `status` | `pending` \| `in_progress` \| `completed` | 工单状态 |

**排队规则**（前后端均已实现）：

- 全局同时只有 **1 条** `in_progress`
- 其余为 `pending`，按 FIFO 排队
- 当前工单完成后变为 `completed`，下一条 `pending` 自动升为 `in_progress`
- 新工单追加到队列末尾

### 图文直播

#### 普通事件

```json
{
  "action": "event.created",
  "payload": {
    "id": "evt-550e8400-e29b-41d4-a716-446655440000",
    "type": "grab_success",
    "title": "抓取成功",
    "description": "第 3 层托盘已入夹爪，夹持力 12N",
    "timestamp": "2026-06-29T10:23:45.000Z",
    "visible": true
  }
}
```

前端：追加到 `liveEvents` 末尾，保留最近 40 条，自动滚到底部。

#### Thinking 流式（已实现）

```json
// 1) 创建事件（不含 thinking 全文）
{ "action": "event.created", "payload": { "id": "evt-x", "type": "arrived_pickup", "title": "抵达取料货架", ... } }

// 2) 流式追加（每字一帧，含完整 thinking）
{ "action": "event.thinking.delta", "payload": { "eventId": "evt-x", "delta": "定", "thinking": "定" } }

// 3) 结束
{ "action": "event.thinking.done", "payload": { "eventId": "evt-x" } }
```

前端处理（联调模式）：

- `event.created` → 插入条目
- `event.thinking.delta` → **替换** `thinking` 为 payload 中的完整 `thinking`（非本地累加）
- `event.thinking.done` → 关闭 streaming 光标

Mock 模式：后端一次给全文，前端 40ms/字打字机动画。

#### 配图方案

| 方案 | 状态 | 说明 |
|------|------|------|
| 前端 SVG | **已实现** | `EventSnapshot` 按 type 渲染 |
| 事件快照 URL | 待对接 | 事件携带 `snapshotUrl`，前端 `<img>` 展示 |
| 复用实时流 | 待对接 | Feed 仅图标，真实画面见摄像头区域 |

### 工单池推送

**新工单**：

```json
{
  "action": "workorder.created",
  "payload": {
    "id": "WO-20260629-004",
    "totalTrays": 25,
    "deliveredTrays": 0,
    "pickup": "取料货架 A-01",
    "delivery": "送料货架 B-09",
    "status": "pending"
  }
}
```

**进度 / 完成 / 切换**：

```json
{ "action": "workorder.updated", "payload": { "id": "...", "deliveredTrays": 20, ... } }
{ "action": "workorder.completed", "payload": { "id": "...", "deliveredTrays": 35, ... } }
{ "action": "workorder.started", "payload": { "id": "...", "status": "in_progress", ... } }
```

`workorder.started` 同时清空图文直播（等效 `feed.clear`）。

### 机器人状态与地图

```json
{
  "action": "state.patch",
  "payload": {
    "robot": { "mode": "navigating", "speed": 0.35, "taskId": "WO-20260629-001" },
    "map": {
      "robotPos": { "x": 120, "y": 80 },
      "currentStepTitle": "正在前往取料货架",
      "activeRoute": "home-pickup"
    }
  }
}
```

### 连接快照

Dashboard WebSocket 连接成功后立即收到：

```json
{
  "action": "snapshot",
  "payload": {
    "liveEvents": [],
    "workOrders": [],
    "robotStatus": { "name": "TrayBot-01", "mode": "idle", ... },
    "mapState": { "robotPos": {"x": 80, "y": 320}, "currentStepTitle": "", "activeRoute": null }
  }
}
```

### 时序示意

```
Agent            Backend              Frontend
  │                 │                      │
  │──agent.event───▶│──event.created──────▶│ 追加 FeedItem
  │──thinking.delta▶│──thinking.delta─────▶│ 替换 thinking
  │──thinking.done─▶│──thinking.done──────▶│ 停止光标
  │──agent.state───▶│──state.patch────────▶│ 更新地图/状态
  │──workorder.done▶│──completed+feed.clear▶│ 清空 feed，更新工单
  │                 │──workorder.started──▶│ 下一条开始
```

---

## 关键源文件索引

| 文件 | 职责 |
|------|------|
| `shared/traybot_protocol/` | Agent / Backend 共享协议 |
| `agent/app/workflow/` | LangGraph 工作流 |
| `agent/app/reporter.py` | 端侧 → 云端上报 |
| `agent/app/runner.py` | 逐步执行 + 导航插值 |
| `backend/app/hub.py` | 云端消息转发 |
| `backend/app/work_orders.py` | 工单池 |
| `front/src/hooks/useDashboard.ts` | Mock / 联调切换 |
| `front/src/hooks/useDashboardSocket.ts` | WebSocket 单例消费 |
| `front/src/components/WorkOrderPool.tsx` | 工单池 UI |
| `front/src/components/LiveFeed.tsx` | 图文直播 + Thinking |
| `front/src/types/index.ts` | 前端类型定义 |

---

## 环境变量

| 变量 | 位置 | 默认 | 说明 |
|------|------|------|------|
| `VITE_USE_MOCK` | `front/.env.development` | `false` | `true` → Mock 模式 |
| `VITE_WS_URL` | 可选 | 自动推导 | 覆盖 Dashboard WS 地址 |
| `--cloud-url` | Agent CLI | `ws://127.0.0.1:8000/ws/agent` | Agent 云端地址 |
| `--robot-id` | Agent CLI | `TrayBot-01` | |
| `PYTEST_DISABLE_PLUGIN_AUTOLOAD` | 测试脚本 | `1` | 避免 ROS launch_testing 冲突 |

Agent / Backend 无 `.env` 文件，配置靠 CLI 参数或代码默认值。

---

## 测试

```bash
cd agent && ./run_tests.sh
cd backend && ./run_tests.sh
cd front && npm run build
```

Agent 测试：`test_graph.py`（11 事件、线性顺序、Thinking 节点集合）。  
Backend 测试：工单创建、重复 409、空池首单 in_progress、完成后自动启动下一单。

---

## 常见问题

| 现象 | 原因 / 处理 |
|------|-------------|
| Agent 报「已有实例在运行」 | 停止旧进程或 `rm -f /tmp/traybot-agent.lock` |
| 前端无事件 | 确认 `VITE_USE_MOCK=false`；backend :8000 已起；Agent 已连 `/ws/agent` |
| 工单不执行 | 需 Agent 在线；首单自动 in_progress 并 assign |
| Thinking 文字重复 | 已修复：WS 单例 + backend 发完整 `thinking` + 联调禁用本地打字机；**需重启 backend 并刷新浏览器** |
| Vite proxy `ECONNREFUSED 8000` | backend 未启动 |
| 视频无法播放 | 需 H.264 baseline + faststart；检查 `front/public/videos/` |
| WS 连接失败 | 确认 Vite proxy `/ws`；或设 `VITE_WS_URL=ws://127.0.0.1:8000/ws/dashboard` |
| pytest 插件冲突 | 使用 `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` |
| 工单只送一批 | Agent 当前单批次 11 步即 done；多批次仅 Mock 支持 |
| 移动控制无响应 | 面板为 Demo UI，未接真实后端 |
| 图文直播事件重复 | 已修复：WebSocket 单例 + 事件 `id` 去重 |

---

## 待实现

- 真实 ROS / 硬件对接
- 工单持久化（数据库）
- LLM 真推理（替换预置 Thinking 文案）
- Agent 多批次循环（totalTrays > backpackCapacity）
- 摄像头 WebRTC / HLS 实时流
- 事件 `snapshotUrl` 截帧上传
- `batch_decision` 工作流节点
- 移动控制面板后端对接
