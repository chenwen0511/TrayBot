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

四区暗黑主题布局（`front/src/App.tsx`）：

| 区域 | 组件 | 功能 |
|------|------|------|
| 顶栏 | `Header` | 标题、急停 E-STOP、告警/日志/设置、用户 admin |
| 左栏 | `LeftSidebar` | 机器人状态（**当前盘数/背包容量: X/Y**）、系统运行状态、三路相机条 |
| 中央 | `MapVisualization` | 3D 体素厂房地图（Three.js）、2D/3D 切换、地图工具栏 |
| 右栏 | `RightSidebar` | 任务执行列表、实时图文直播、导航控制 |

**已实现组件**：

| 组件 | 路径 | 说明 |
|------|------|------|
| `Header` | `components/Header.tsx` | 顶栏导航与急停 |
| `LeftSidebar` | `components/LeftSidebar.tsx` | 机器人状态、电量环、相机条 |
| `CameraStrip` | `components/CameraStrip.tsx` | 左手腕 / 头部 / 右手腕 MP4 循环 |
| `MapVisualization` | `components/MapVisualization.tsx` | 地图容器、状态浮层、工具栏 |
| `VoxelMap3D` | `components/VoxelMap3D.tsx` | Three.js 体素块渲染（`renderMode: blocks`） |
| `VoxelMapLayer` | `components/VoxelMapLayer.tsx` | 2D 俯视图层 |
| `TaskExecutionList` | `components/TaskExecutionList.tsx` | 右栏工单/任务列表 |
| `LiveFeed` | `components/LiveFeed.tsx` | 图文直播、Thinking 展示、**自动滚到底部** |
| `NavigationControl` | `components/NavigationControl.tsx` | 单点导航 / 自动回充 / 键盘遥控（**UI Demo，未接后端**） |
| `EventSnapshot` | `components/EventSnapshot.tsx` | 按事件 type 渲染 SVG 配图 |
| `WorkOrderPool` | `components/WorkOrderPool.tsx` | 工单池（旧布局组件，仍可用于拆分视图） |

背包数量来源：`state.patch` 的 `robot.backpackTrays`，或从 `put_backpack` / `taking_out` 事件描述解析（`utils/backpackStatus.ts`）。

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
- `/api` → backend（地图配置等）
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
| 配图 | `EventSnapshot` SVG | 有 `imageUrl` 时显示 MinIO 相机帧，失败回退 SVG |
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

- 地图数据：`backend/maps/factory_01.json`（15m×30m SMT 厂房，体素块 + 地标）
- 前端启动时 `useMapConfig` 请求 `GET /api/map?map_id=factory_01`，失败时使用本地 fallback
- 3D 渲染：`VoxelMap3D`（Three.js 实体块，非百万级体素点云）
- Agent 2D 坐标与地图地标对齐（`agent/app/map_state.py`，scale2d=20）
- 地标示例：home `(34,208)`，pickup `(294,72)`，delivery `(268,198)`
- `activeRoute`：`home-pickup` | `pickup-delivery` | `delivery-home` | `delivery-pickup`
- 导航时 Agent 以 20 帧 / 7s 高频推送 `state.patch` 更新 `robotPos`

重新生成地图：

```bash
python backend/maps/generate_smt_factory.py
```

### Mock 专有行为（`mock/useMockDashboard.ts` + `mock/workflow.ts`）

| 常量 | 值 |
|------|-----|
| `EVENT_INTERVAL` | 7000 ms/步 |
| `CYCLE_COOLDOWN` | 60000 ms 后重跑 |
| 新工单注入 | 每 30s 随机 pending |
| 预置工单 | 2 completed + 1 in_progress + 2 pending |
| 工作流 | `buildWorkflow()` 与 Agent 对齐：逐盘 pick/place 子步骤、多批次循环 |

Mock 与 Agent 均支持 **多批次**（`totalTrays > backpackCapacity`）。骨架阶段首盘抓取/放置各模拟一次失败重试。

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

### 工作流总览

**单主图扁平实现**（LangGraph StateGraph，无 subagent），**逐盘循环**，支持多批次。流程图见 `doc/agent_workflow_main.png`。

```
__start__
  → order_received           ★ Thinking（电量自检，visible=false）
  → nav_to_pickup → arrived_pickup
  ┌─ 取料循环 ────────────────────────────────────────────────┐
  │  enter_pick → pick_pem → pick_validate → pick_execute │
  │            → pick_in_hand → grab_success → put_backpack    │
  │              ↑ fail: pick_retry ──→ pick_pem        │
  │              ↑__________________________|                  │
  └────────────────────────────────────────────────────────────┘
  → nav_to_delivery → arrived_delivery
  ┌─ 放料循环 ────────────────────────────────────────────────┐
  │  place_pem（放置位姿估计，夹爪空手，输出想象图）                │
  │  → place_validate → take_from_backpack → check_in_hand      │
  │  → enter_place → place_execute → place_verify              │
  │            → put_shelf_success                             │
  │              ↑ fail: place_retry → place_pem               │
  │              ↑__________________________|                  │
  └────────────────────────────────────────────────────────────┘
  → batch_decision             ★ Thinking（是否继续取料 / 返回 HOME）
  → nav_to_pickup | return_home → __end__
```

**放置流程**（解决手腕相机持盘遮挡）：

1. **`place_pem`**：夹爪无料盘时估计放置位姿并输出想象图
2. **`place_validate`**：校验想象图中的空位与放置路径
3. **`take_from_backpack` → `check_in_hand`**：取料并在手检测，未检测到则重试取料（最多 3 次）
4. **`place_execute` → `place_verify`**：执行放置并检测
5. 背包仍有料 → 回到 **`place_pem`** 估计下一空位，重复 2–4

节点定义见 `shared/traybot_protocol/models.py` → `MAIN_GRAPH_NODES`（24 个扁平节点）。

- `THINKING_NODES`：`order_received`、`batch_decision`
- `MAX_PICK_RETRIES` / `MAX_PLACE_RETRIES` / `MAX_TAKE_RETRIES`：3
- `MIN_BATTERY_PERCENT`：20（低于阈值拒绝执行）

### 工作流状态（`workflow/state.py`）

| 字段 | 说明 |
|------|------|
| `work_order` | 当前工单 |
| `backpack_count` | 背包内盘数（入包 +1，取出 -1） |
| `batch_number` | 当前趟次（多批次递增） |
| `pick_attempt` / `place_attempt` | 抓取/放置重试计数 |
| `events` | 累积 LiveEvent（按 `id` 去重合并） |

### 目录结构

```
agent/
├── app/
│   ├── workflow/
│   │   ├── graph.py          # 主工作流图（单图扁平）
│   │   ├── nodes.py          # 全部节点（Pick + Place + 导航）
│   │   ├── state.py          # WorkflowState
│   │   └── emit.py           # 事件发射辅助
│   ├── reporter.py           # CloudReporter — Legacy WebSocket
│   ├── mqtt_reporter.py      # MqttCloudReporter — 默认 MQTT
│   ├── runner.py             # 逐步执行 + 导航插值 + 背包上报 + 事件去重
│   ├── map_state.py          # 事件 → 地图/机器人 state patch
│   └── main.py               # CLI + 文件锁
└── tests/
    └── test_graph.py         # 主图节点、多批次、背包计数
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
3. 执行 `run_workflow_on_cloud()`：
   - `astream(updates)` 逐步上报；子图内步骤亦产生事件
   - `put_backpack` / `take_from_backpack` 时在 `state.patch` 附带 `robot.backpackTrays`
   - 每盘 `put_shelf_success` 触发 `agent.workorder.progress`
   - 已发布事件按 `id` 去重，避免子图完成时重复推送
4. 全部送达后发 `agent.workorder.done`，循环等待下一单

**多批次**：`totalTrays > backpackCapacity` 时自动多趟取送；`batch_decision` 决策继续取料或 `return_home`。

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
| `/api/map` | GET | 地图配置（`?map_id=factory_01`） |
| `/api/maps` | GET | 可用地图列表 |

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
│   ├── server.py       # FastAPI 入口 + REST + WS
│   ├── hub.py          # ConnectionHub — 连接管理 + 消息转发
│   ├── work_orders.py  # WorkOrderStore — 工单池（权威源）
│   ├── state.py        # DashboardState — 运行时快照（含 backpackTrays）
│   ├── map_loader.py   # 地图 JSON 加载
│   └── mqtt_bridge.py  # MQTT Bridge
├── maps/
│   ├── factory_01.json # SMT 厂房地图
│   └── generate_smt_factory.py
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
- `LiveEventType`：21 种（含 Pick / Place 子步骤，见下表）
- `MAIN_GRAPH_NODES` / `NODE_SEQUENCE`
- 类型定义亦见 `front/src/types/index.ts`，对接时应保持一致。

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
| `imageUrl` | string | | MinIO 相机帧直链（Agent 上传，Front 直读） |
| `timestamp` | ISO8601 | ✓ | 事件发生时间 |
| `visible` | boolean | | 默认 `true`；`false` 时不进 feed |

**LiveEventType**：

| type | 含义 |
|------|------|
| `order_received` | 收到工单 + 电量自检（不进 feed） |
| `nav_to_pickup` | 导航前往取料货架 |
| `arrived_pickup` | 抵达取料货架 |
| `pick_pem` | 抓取位姿估计（PEM） |
| `pick_validate` | 预想抓取位姿校验 |
| `pick_execute` | 执行抓取 |
| `pick_in_hand` | 在手检测 |
| `pick_retry` | 抓取重试 |
| `grab_success` | 抓取成功（单盘） |
| `put_backpack` | 放入背包（上报背包计数） |
| `nav_to_delivery` | 导航前往送料货架 |
| `arrived_delivery` | 抵达送料货架 |
| `taking_out` | 从背包取出（上报背包计数） |
| `check_in_hand` | 取背包后在手检测 |
| `place_pem` | 放置位姿估计（夹爪空手，输出想象图） |
| `place_validate` | 校验 place_pem 想象图中的空位与放置路径 |
| `place_execute` | 执行放置 |
| `place_verify` | 放置检测 |
| `place_retry` | 放置重试 |
| `put_shelf_success` | 放入货架成功（单盘，累加 delivered） |
| `batch_decision` | 批次决策（继续取料 / 返回 HOME）★ Thinking |
| `return_home` | 返回 HOME |

#### WorkOrder（工单）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 工单号 |
| `totalTrays` | number | 总盘数 |
| `deliveredTrays` | number | 已送盘数 |
| `pickup` | string | 取料货架 |
| `delivery` | string | 送料货架 |
| `backpackCapacity` | number | 背包容量（默认 20） |
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
{ "action": "event.created", "payload": { "id": "evt-x", "type": "batch_decision", "title": "决策：继续取料", ... } }

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
    "robot": {
      "mode": "navigating",
      "speed": 0.35,
      "taskId": "WO-20260629-001",
      "backpackTrays": 5
    },
    "map": {
      "robotPos": { "x": 120, "y": 80 },
      "currentStepTitle": "导航前往取料货架",
      "activeRoute": "home-pickup"
    }
  }
}
```

前端左栏显示：**当前盘数/背包容量: 5/20**。

### 连接快照

Dashboard WebSocket 连接成功后立即收到：

```json
{
  "action": "snapshot",
  "payload": {
    "liveEvents": [],
    "workOrders": [],
    "robotStatus": { "name": "TrayBot-01", "mode": "idle", "backpackTrays": 0, ... },
    "mapState": { "robotPos": {"x": 34, "y": 208}, "currentStepTitle": "", "activeRoute": null }
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
| `shared/traybot_protocol/models.py` | LiveEvent、WorkOrder、节点序列、THINKING_NODES |
| `agent/app/workflow/graph.py` | 主工作流 LangGraph |
| `agent/app/workflow/nodes.py` | 全部节点实现 |
| `agent/app/runner.py` | 逐步执行 + 导航插值 + 背包上报 |
| `agent/app/map_state.py` | 事件 → 地图状态 |
| `backend/app/hub.py` | 云端消息转发 |
| `backend/app/map_loader.py` | 地图 API |
| `backend/maps/factory_01.json` | SMT 厂房地图数据 |
| `front/src/hooks/useDashboard.ts` | Mock / 联调切换 |
| `front/src/hooks/useDashboardSocket.ts` | WebSocket 单例消费 |
| `front/src/hooks/useMapConfig.ts` | 地图配置加载 |
| `front/src/components/MapVisualization.tsx` | 中央 3D 地图 |
| `front/src/components/LiveFeed.tsx` | 图文直播 + Thinking |
| `front/src/components/LeftSidebar.tsx` | 机器人状态 + 背包显示 |
| `front/src/mock/workflow.ts` | Mock 工作流（与 Agent 对齐） |
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

Agent 测试：`test_graph.py`（编排节点、Pick/Place 子步骤、多批次送达、背包计数、Thinking 节点）。  
Backend 测试：工单创建、重复 409、空池首单 in_progress、完成后自动启动下一单、地图 API。

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
| pytest 插件冲突 | 使用 `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`（见 `agent/run_tests.sh`） |
| 地图一直加载 / 3D 卡顿 | 确认 `/api/map` 可达；体素已改为实体块渲染（~55 块） |
| 移动控制无响应 | 面板为 Demo UI，未接真实后端 |
| 图文直播事件重复 | 已修复：WS 单例 + 事件 `id` 去重 + runner 发布去重 |

---

## 待实现

- 真实 ROS / 硬件对接（主图节点内替换为视觉 + 夹爪 Skill）
- 工单持久化（数据库）
- LLM 真推理（替换预置 Thinking 文案）
- 摄像头 WebRTC / HLS 实时流
- 事件 `snapshotUrl` 截帧上传
- 导航控制面板后端对接
- LiDAR 点云 / 占据栅格实时地图（当前为预烘焙体素块）
