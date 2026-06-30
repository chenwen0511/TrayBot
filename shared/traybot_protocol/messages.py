"""Agent ↔ Cloud ↔ Frontend WebSocket 消息 action 常量。"""

from enum import StrEnum


class AgentAction(StrEnum):
    HELLO = "agent.hello"
    EVENT = "agent.event"
    THINKING_DELTA = "agent.thinking.delta"
    THINKING_DONE = "agent.thinking.done"
    STATE = "agent.state"
    WORKORDER_PROGRESS = "agent.workorder.progress"
    WORKORDER_DONE = "agent.workorder.done"


class DashboardAction(StrEnum):
    SNAPSHOT = "snapshot"
    EVENT_CREATED = "event.created"
    THINKING_DELTA = "event.thinking.delta"
    THINKING_DONE = "event.thinking.done"
    FEED_CLEAR = "feed.clear"
    STATE_PATCH = "state.patch"
    WORKORDER_CREATED = "workorder.created"
    WORKORDER_UPDATED = "workorder.updated"
    WORKORDER_COMPLETED = "workorder.completed"
    WORKORDER_STARTED = "workorder.started"
    PONG = "pong"


class CloudToAgentAction(StrEnum):
    WORKORDER_ASSIGN = "workorder.assign"
    PING = "ping"
