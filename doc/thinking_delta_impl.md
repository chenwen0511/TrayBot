# Thinking Delta 实现原理

本文档说明 TrayBot **Thinking 流式展示**的端到端实现：从 Agent 生成文案，经 MQTT（或 Legacy WebSocket）到 Backend，再经 WebSocket 推送到 Dashboard 的完整数据流、时序与设计取舍。

> 协议 action 常量：`shared/traybot_protocol/messages.py`  
> 三方总览：[3part_conn.md](./3part_conn.md) §7.3

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| **流式体验** | 图文直播里 Thinking 像「正在推理」一样逐字出现，而不是整段瞬间弹出 |
| **传输层无关** | `{ action, payload }` Envelope 不变；MQTT 与 WebSocket 共用同一套 thinking 序列 |
| **Dashboard 简单** | 联调模式下前端**不做**本地打字机动画，只渲染 Backend 推送的累计全文 |
| **状态可恢复** | Backend 在服务端累积 thinking，每帧带完整 `thinking` 字段，新连接的 Dashboard 也能从 snapshot 看到已累积内容 |

**当前实现说明**：Thinking 文案来自 LangGraph 节点预置字符串（`THINKING_NODES`），并非真实 LLM 流式推理；Agent 用固定间隔逐字**模拟**推送节奏。

---

## 2. 架构总览

```
┌─────────┐   agent.event            ┌─────────┐   event.created        ┌───────────┐
│         │   agent.thinking.delta ×N  │         │   event.thinking.delta │           │
│  Agent  │ ──MQTT osd / WS────────▶ │ Backend │ ──WebSocket──────────▶ │ Dashboard │
│         │   agent.thinking.done    │  Hub    │   event.thinking.done  │  LiveFeed │
└─────────┘                          └─────────┘                        └───────────┘
```

- **Agent → Backend**：默认 MQTT Topic `thing/product/traybot/{robotId}/osd`；Legacy 模式为 `WS /ws/agent`
- **Backend → Dashboard**：始终 `WS /ws/dashboard`（浏览器不直连 MQTT）
- **Dashboard 不直连 Agent**

---

## 3. 哪些步骤有 Thinking

定义于 `shared/traybot_protocol/models.py` → `THINKING_NODES`：

| 节点 type | 说明 |
|-----------|------|
| `order_received` | 收到工单，规划取送路线 |
| `arrived_pickup` | 到达取料点，分析目标 |
| `batch_decision` | 多批次决策（是否继续取料） |

每个 `LiveEvent` 可携带 `thinking: str | None`。有 thinking 的节点在 `publish_event()` 时会走 delta 流程；无 thinking 的节点只发一条 `agent.event`。

---

## 4. Agent 侧：发送序列

实现：`agent/app/mqtt_reporter.py`（MQTT）、`agent/app/reporter.py`（Legacy WebSocket）。两者 `publish_event()` 逻辑一致。

### 4.1 三步协议

对**每一个**带 thinking 的步骤事件：

```
1. agent.event          — 事件骨架（ deliberately 不含 thinking 全文）
2. agent.thinking.delta — 每个 Unicode 字符一条，间隔 THINKING_CHAR_DELAY
3. agent.thinking.done  — 标记该 eventId 的 thinking 流结束
```

核心代码：

```python
async def publish_event(self, event: LiveEvent, task_id: str) -> None:
    payload = event.to_feed_dict()
    thinking = payload.pop("thinking", None)   # 从 event 中剥离
    payload["taskId"] = task_id
    await self._send(AgentAction.EVENT, payload)
    if thinking:
        for char in thinking:
            await self._send(
                AgentAction.THINKING_DELTA,
                {"eventId": event.id, "delta": char},
            )
            await asyncio.sleep(THINKING_CHAR_DELAY)  # 0.04 s
        await self._send(AgentAction.THINKING_DONE, {"eventId": event.id})
```

### 4.2 为何 event 与 thinking 分离

1. **先出卡片、后出文字**：Dashboard 收到 `event.created` 后立即显示步骤标题与图标，thinking 区域随后逐字填充。
2. **避免双通道重复**：若 `agent.event` 带全文 thinking，Dashboard 可能先渲染全文再收 delta，造成闪烁或重复（历史上曾因此修复）。
3. **与 Mock 模式对齐**：Mock 本地一次性有全文；联调模式走 delta，两种路径在 UI 层用 `deltaStream` 开关区分。

### 4.3 时序常量

| 常量 | 值 | 位置 | 含义 |
|------|-----|------|------|
| `THINKING_CHAR_DELAY` | `0.04` s/字 | `reporter.py` / `mqtt_reporter.py` | 相邻两条 delta 的发送间隔 |
| `INSTANT_NODE_DELAY` | `5.0` s | `runner.py` | 非导航步骤的基础停留 |
| 实际 dwell | `max(5.0 - 字数×0.04, 1.5)` | `runner.py` `_dwell_after_step` | 扣除 thinking 推送已耗时间，避免步骤切换过快 |

Thinking 推送时间与步骤停留时间**联动**：字越多，Agent 在 delta 阶段已 sleep 越久，节点结束后的额外 dwell 越短。

### 4.4 MQTT 与 WebSocket 的差异

仅**传输层**不同：MQTT 每条 `_send` 对应一次 `publish` 到 `osd` topic；WebSocket 对应一次 `ws.send`。Envelope 与 action 字符串完全相同。

---

## 5. Backend 侧：累积与转发

实现：`backend/app/hub.py` → `ConnectionHub.handle_agent_message()`

### 5.1 处理 `agent.event`

- 校验 `taskId` 与当前执行工单 `_executing_order_id` 一致
- 写入 `dashboard_state.live_events`（visible 为 true 时）
- 广播 `event.created` 给所有 Dashboard WebSocket 客户端
- **此时事件对象不含 thinking 字段**（Agent 已 pop 掉）

### 5.2 处理 `agent.thinking.delta`

```python
self._pending_thinking[event_id] = self._pending_thinking.get(event_id, "") + delta
full = self._pending_thinking[event_id]
# 同步更新 dashboard_state 中对应事件的 thinking
await self.broadcast_dashboard(
    DashboardAction.THINKING_DELTA,
    {"eventId": event_id, "delta": delta, "thinking": full},
)
```

要点：

| 字段 | 方向 | 含义 |
|------|------|------|
| `delta` | Agent → Backend → Dashboard | 本帧新增的一个字符 |
| `thinking` | Backend 生成 → Dashboard | **截至本帧的累计全文** |

Backend **每收到一条** Agent delta **立即转发**，不批量、不等待全文收齐。

**为何 payload 要带完整 `thinking`？**

- Dashboard 用**替换**而非 `+= delta`，避免前端重复追加导致乱码
- 新连接的 Dashboard 从 `snapshot` 或中途加入时，单帧 payload 即含当前完整 thinking
- Java 等其他 Backend 实现应同样维护 `_pending_thinking[eventId]`（见 [for_java_backent.md](./for_java_backent.md)）

### 5.3 处理 `agent.thinking.done`

- 清除 `_pending_thinking[event_id]`
- 广播 `event.thinking.done`，payload 为 `{"eventId": "..."}`

### 5.4 MqttBridge 的角色

`backend/app/mqtt_bridge.py` 订阅 `thing/product/traybot/+/osd`，将 MQTT payload 解析为与 WebSocket 相同的 envelope，调用 `hub.handle_agent_message()`。**Thinking 逻辑全部在 Hub 内**，Bridge 不做特殊处理。

---

## 6. Dashboard 侧：接收与渲染

实现：`front/src/hooks/useDashboardSocket.ts`、`front/src/components/LiveFeed.tsx`

### 6.1 WebSocket 消息处理

```typescript
if (action === 'event.created') {
  appendEvent(parseEvent(payload))  // 此时通常无 thinking
}

if (action === 'event.thinking.delta') {
  const eventId = String(payload.eventId)
  const thinking = payload.thinking != null
    ? String(payload.thinking)
    : String(payload.delta)
  setThinkingLiveId(eventId)
  setLiveEvents(prev =>
    prev.map(e => e.id === eventId ? { ...e, thinking } : e),
  )
}

if (action === 'event.thinking.done') {
  setThinkingLiveId(cur => cur === eventId ? null : cur)
}
```

**联调模式是「真·逐条接收」**：每来一条 `event.thinking.delta` 就更新一次 React state，UI 重绘一次；**不是**一次收全文再本地假打字。

### 6.2 `deltaStream` 与 Mock 模式分支

`App.tsx`：

```typescript
const deltaStream = import.meta.env.VITE_USE_MOCK === 'false'
```

| 模式 | `VITE_USE_MOCK` | Thinking 来源 | LiveFeed 行为 |
|------|-----------------|---------------|---------------|
| **联调** | `false` | 逐条 WS `event.thinking.delta` | `StreamingThinking` 直接渲染 `content`，无本地动画 |
| **Mock** | `true` | 事件对象自带完整 `thinking` | `MockStreamingThinking` 用 `setInterval(40ms)` 本地打字机 |

联调分支注释（`LiveFeed.tsx`）：

> 联调模式：后端已逐字推送，直接渲染，避免本地打字机叠加

若联调时仍开启本地打字机，会出现「Backend 推一字 + 前端再动画一遍」的双重效果。

### 6.3 流式光标 `thinkingLiveId`

- 收到 delta 时：`thinkingLiveId = eventId`
- 收到 done 时：若匹配则置 `null`
- 仅**最新一条**事件且 `event.id === thinkingLiveId` 时显示紫色脉冲光标（`streaming={true}`）

### 6.4 自动滚动

`LiveFeed` 在 `events.length`、`lastEvent.thinking`、`thinkingLiveId` 变化时滚到底部，保证 thinking 增长时用户能看到最新内容。

---

## 7. 完整时序示例

假设某步骤 thinking 全文为 `"定位目标"`（4 字），eventId 为 `evt-001`：

```
时间轴    Agent (MQTT/WS)              Backend                    Dashboard
─────────────────────────────────────────────────────────────────────────
T+0ms     agent.event                → event.created            出现步骤卡片（无 thinking）
          { id, type, title, ... }

T+0ms     agent.thinking.delta       → event.thinking.delta       thinking = "定"
          { eventId, delta:"定" }       { delta, thinking:"定" }

T+40ms    agent.thinking.delta       → event.thinking.delta       thinking = "定位"
          { delta:"位" }                { delta, thinking:"定位" }

T+80ms    ... "目" ...

T+120ms   ... "标" ...

T+120ms   agent.thinking.done        → event.thinking.done        光标消失
          { eventId:"evt-001" }
```

MQTT 路径下，左侧每一行均为独立的 MQTT publish；Dashboard 侧看到的 WS 消息序列与上表右侧一致。

---

## 8. 消息格式速查

### Agent → Backend

**`agent.event`**（无 thinking）：

```json
{
  "action": "agent.event",
  "payload": {
    "id": "evt-abc123",
    "type": "arrived_pickup",
    "title": "到达取料点",
    "timestamp": "2026-06-29T10:00:00+08:00",
    "visible": true,
    "taskId": "WO-20260629-001"
  }
}
```

**`agent.thinking.delta`**：

```json
{
  "action": "agent.thinking.delta",
  "payload": {
    "eventId": "evt-abc123",
    "delta": "定"
  }
}
```

**`agent.thinking.done`**：

```json
{
  "action": "agent.thinking.done",
  "payload": {
    "eventId": "evt-abc123"
  }
}
```

### Backend → Dashboard

**`event.thinking.delta`**（注意多了累计 `thinking`）：

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

**`event.thinking.done`**：

```json
{
  "action": "event.thinking.done",
  "payload": {
    "eventId": "evt-abc123"
  }
}
```

Action 字符串映射见 `shared/traybot_protocol/messages.py`：

| Agent action | Dashboard action |
|--------------|------------------|
| `agent.thinking.delta` | `event.thinking.delta` |
| `agent.thinking.done` | `event.thinking.done` |

---

## 9. 关键设计决策小结

| 问题 | 决策 |
|------|------|
| thinking 谁逐字？ | **Agent** 按字 sleep 发送；Backend 透传+累积；Dashboard 只渲染 |
| Dashboard 是否假打字？ | 联调**否**；Mock **是**（本地 `MockStreamingThinking`） |
| delta payload 为何带全文？ | 前端**替换**字段，避免 `+=` 重复；便于 snapshot/中途订阅 |
| thinking 为何不在 event 里？ | 先展示事件骨架，再流式填 thinking；避免双份全文 |
| MQTT 是否改变 thinking 语义？ | **否**，仅换传输；Hub 处理逻辑与 WS Agent 相同 |

---

## 10. 源码索引

| 层级 | 文件 | 职责 |
|------|------|------|
| 协议 | `shared/traybot_protocol/messages.py` | action 常量 |
| 协议 | `shared/traybot_protocol/models.py` | `LiveEvent.thinking`、`THINKING_NODES` |
| Agent | `agent/app/mqtt_reporter.py` | MQTT 版 `publish_event` + delta 循环 |
| Agent | `agent/app/reporter.py` | WebSocket 版（逻辑相同） |
| Agent | `agent/app/runner.py` | 调用 `publish_event`；dwell 与 thinking 时长联动 |
| Backend | `backend/app/hub.py` | `_pending_thinking` 累积；转发 Dashboard |
| Backend | `backend/app/mqtt_bridge.py` | MQTT → `handle_agent_message` |
| Front | `front/src/hooks/useDashboardSocket.ts` | 消费 delta/done，维护 `thinkingLiveId` |
| Front | `front/src/components/LiveFeed.tsx` | `deltaStream` / `MockStreamingThinking` 分支 |
| Front | `front/src/App.tsx` | `deltaStream = VITE_USE_MOCK === 'false'` |

---

## 11. 常见问题

| 现象 | 可能原因 |
|------|----------|
| Thinking 文字重复、乱码 | 前端对 delta 做了 `+=` 而非用 `payload.thinking` **替换**；或联调时误开本地打字机 |
| Thinking 瞬间全文出现 | 使用了 Mock 模式；或 Agent 未走 delta（thinking 为空） |
| 有事件无 thinking | 该节点不在 `THINKING_NODES`；或 `agent.event` 已到但 delta 尚未开始 |
| MQTT 联调无 thinking | Agent 未连 Broker；检查 osd topic 与 Backend `mqtt_bridge_connected` |
| 重连后 thinking 丢失 | 正常：`_pending_thinking` 在 done 后清除；未完成流的重连需 Agent 重发或 Backend 持久化（当前未实现） |

---

## 12. 后续扩展（未实现）

- **真实 LLM 流式**：可将模型 token 流直接映射为 `agent.thinking.delta`，Backend/Dashboard 链路无需改动
- **断线续传**：Backend 持久化 `_pending_thinking`，Agent 重连后从 offset 继续
- **节流/合并**：高吞吐时可 Backend 合并多字为一帧，需同步调整 Dashboard 渲染策略
