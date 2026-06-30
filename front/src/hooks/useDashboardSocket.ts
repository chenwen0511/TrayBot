import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ActiveRoute } from '../mock/useMockDashboard'
import type { LiveEvent, LiveEventType, MapPoint, RobotMode, RobotStatus, WorkOrder } from '../types'
import { mockMapPoints, mockRobotStatus } from '../mock/data'

const LANDMARKS = mockMapPoints.filter((p) => p.type !== 'robot')

function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined
  if (env) return env
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/dashboard`
}

function parseEvent(raw: Record<string, unknown>): LiveEvent {
  return {
    id: String(raw.id),
    type: raw.type as LiveEventType,
    title: String(raw.title),
    description: raw.description ? String(raw.description) : undefined,
    thinking: raw.thinking ? String(raw.thinking) : undefined,
    timestamp: new Date(String(raw.timestamp)),
  }
}

function normalizeWorkOrderQueue(orders: WorkOrder[]): WorkOrder[] {
  let activeAssigned = false
  return orders.map((o) => {
    if (o.status !== 'in_progress') return o
    if (activeAssigned) return { ...o, status: 'pending' as const }
    activeAssigned = true
    return o
  })
}

function parseWorkOrder(raw: Record<string, unknown>): WorkOrder {
  return {
    id: String(raw.id),
    totalTrays: Number(raw.totalTrays),
    deliveredTrays: Number(raw.deliveredTrays),
    pickup: String(raw.pickup),
    delivery: String(raw.delivery),
    status: raw.status as WorkOrder['status'],
  }
}

/** 全局唯一 WebSocket，避免 StrictMode / 重连产生双连接导致事件重复 */
type MessageHandler = (msg: { action: string; payload: Record<string, unknown> }) => void

class DashboardSocketClient {
  private ws: WebSocket | null = null
  private handlers = new Set<MessageHandler>()
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false

  subscribe(handler: MessageHandler, onConnectionChange: (connected: boolean) => void) {
    // 仅保留最新 handler，避免 StrictMode / HMR 残留导致 delta 重复追加
    this.handlers.clear()
    this.handlers.add(handler)
    this.ensureConnected(onConnectionChange)
    return () => {
      this.handlers.delete(handler)
      if (this.handlers.size === 0) {
        this.disconnect(onConnectionChange)
      }
    }
  }

  private ensureConnected(onConnectionChange: (connected: boolean) => void) {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }
    this.intentionalClose = false
    this.ws = new WebSocket(wsUrl())

    this.ws.onopen = () => onConnectionChange(true)
    this.ws.onclose = () => {
      onConnectionChange(false)
      this.ws = null
      if (!this.intentionalClose && this.handlers.size > 0) {
        this.retryTimer = setTimeout(() => this.ensureConnected(onConnectionChange), 3000)
      }
    }
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as { action: string; payload: Record<string, unknown> }
      this.handlers.forEach((h) => h(msg))
    }
  }

  private disconnect(onConnectionChange: (connected: boolean) => void) {
    this.intentionalClose = true
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this.ws?.close()
    this.ws = null
    onConnectionChange(false)
  }
}

const dashboardSocket = new DashboardSocketClient()

export function useDashboardSocket(enabled = true) {
  const [robotStatus, setRobotStatus] = useState<RobotStatus>(mockRobotStatus)
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [robotPos, setRobotPos] = useState({ x: 80, y: 320 })
  const [currentStepTitle, setCurrentStepTitle] = useState('')
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>(null)
  const [connected, setConnected] = useState(false)
  const [thinkingLiveId, setThinkingLiveId] = useState<string | null>(null)

  const mapPoints: MapPoint[] = useMemo(
    () => [
      ...LANDMARKS,
      { id: 'robot', type: 'robot', label: 'TrayBot', x: robotPos.x, y: robotPos.y },
    ],
    [robotPos],
  )

  const patchWorkOrder = useCallback((raw: Record<string, unknown>) => {
    const order = parseWorkOrder(raw)
    setWorkOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === order.id)
      const next = idx === -1 ? [...prev, order] : prev.map((o, i) => (i === idx ? order : o))
      return normalizeWorkOrderQueue(next)
    })
  }, [])

  const appendEvent = useCallback((event: LiveEvent) => {
    setLiveEvents((prev) => {
      if (prev.some((e) => e.id === event.id)) return prev
      return [...prev, event].slice(-40)
    })
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleMessage = (msg: { action: string; payload: Record<string, unknown> }) => {
      const { action, payload } = msg

      if (action === 'snapshot') {
        const events = (payload.liveEvents as Record<string, unknown>[]).map(parseEvent)
        setLiveEvents(events)
        setWorkOrders(normalizeWorkOrderQueue(
          (payload.workOrders as Record<string, unknown>[]).map(parseWorkOrder),
        ))
        const robot = payload.robotStatus as Record<string, unknown>
        setRobotStatus((prev) => ({ ...prev, ...(robot as unknown as RobotStatus) }))
        const map = payload.mapState as Record<string, unknown>
        const pos = map.robotPos as { x: number; y: number }
        if (pos) setRobotPos(pos)
        setCurrentStepTitle(String(map.currentStepTitle ?? ''))
        setActiveRoute((map.activeRoute as ActiveRoute) ?? null)
        return
      }

      if (action === 'event.created') {
        if (payload.visible === false) return
        appendEvent(parseEvent(payload))
        if (payload.title) setCurrentStepTitle(String(payload.title))
        return
      }

      if (action === 'event.thinking.delta') {
        const eventId = String(payload.eventId)
        const thinking = payload.thinking != null ? String(payload.thinking) : String(payload.delta)
        setThinkingLiveId(eventId)
        setLiveEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, thinking } : e)),
        )
        return
      }

      if (action === 'event.thinking.done') {
        const eventId = String(payload.eventId)
        setThinkingLiveId((cur) => (cur === eventId ? null : cur))
        return
      }

      if (action === 'state.patch') {
        const robot = payload.robot as Record<string, unknown> | undefined
        const map = payload.map as Record<string, unknown> | undefined
        if (robot) {
          setRobotStatus((prev) => ({
            ...prev,
            ...(robot.mode ? { mode: robot.mode as RobotMode } : {}),
            ...(robot.speed !== undefined ? { speed: Number(robot.speed) } : {}),
            ...(robot.taskId !== undefined ? { taskId: robot.taskId as string | null } : {}),
          }))
        }
        if (map) {
          const pos = map.robotPos as { x: number; y: number } | undefined
          if (pos) setRobotPos(pos)
          if (map.currentStepTitle !== undefined) {
            setCurrentStepTitle(String(map.currentStepTitle))
          }
          if (map.activeRoute !== undefined) {
            setActiveRoute((map.activeRoute as ActiveRoute) ?? null)
          }
        }
        return
      }

      if (action === 'feed.clear') {
        setLiveEvents([])
        setThinkingLiveId(null)
        return
      }

      if (action === 'workorder.started') {
        setLiveEvents([])
        setThinkingLiveId(null)
        patchWorkOrder(payload)
        return
      }

      if (action === 'workorder.updated' || action === 'workorder.completed' || action === 'workorder.created') {
        patchWorkOrder(payload)
      }
    }

    return dashboardSocket.subscribe(handleMessage, setConnected)
  }, [enabled, appendEvent, patchWorkOrder])

  return {
    robotStatus: connected ? robotStatus : { ...robotStatus, mode: 'idle' as RobotMode },
    mapPoints,
    liveEvents,
    workOrders,
    currentStepTitle,
    activeRoute,
    connected,
    thinkingLiveId,
  }
}
