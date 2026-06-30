import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveEvent, MapPoint, RobotStatus, WorkOrder } from '../types'
import { mockMapPoints, mockRobotStatus } from './data'
import { initialWorkOrders } from './workOrders'
import { MOCK_WORK_ORDER, workflowSteps, type WorkflowStep } from './workflow'

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

const LANDMARKS = mockMapPoints.filter((p) => p.type !== 'robot')
const EVENT_INTERVAL = 7000
const CYCLE_COOLDOWN = 60000

export type ActiveRoute =
  | 'home-pickup'
  | 'pickup-delivery'
  | 'delivery-home'
  | 'delivery-pickup'
  | null

function getPoint(id: string) {
  return LANDMARKS.find((p) => p.id === id)!
}

function getActiveRoute(step: WorkflowStep | undefined): ActiveRoute {
  if (!step?.map.move) return null
  const { from, to } = step.map.move
  if (from === 'home' && to === 'pickup') return 'home-pickup'
  if (from === 'pickup' && to === 'delivery') return 'pickup-delivery'
  if (from === 'delivery' && to === 'home') return 'delivery-home'
  if (from === 'delivery' && to === 'pickup') return 'delivery-pickup'
  return null
}

function parseDelivered(description?: string): number | null {
  const match = description?.match(/累计 (\d+)/)
  return match ? parseInt(match[1], 10) : null
}

/** 保证同时只有一条进行中，其余退回排队 */
function normalizeWorkOrderQueue(orders: WorkOrder[]): WorkOrder[] {
  let activeAssigned = false
  return orders.map((o) => {
    if (o.status !== 'in_progress') return o
    if (activeAssigned) return { ...o, status: 'pending' as const }
    activeAssigned = true
    return o
  })
}

export function useMockDashboard(enabled = true) {
  const [robotStatus, setRobotStatus] = useState<RobotStatus>(mockRobotStatus)
  const [robotPos, setRobotPos] = useState(() => {
    const home = LANDMARKS.find((p) => p.id === 'home')!
    return { x: home.x, y: home.y }
  })
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const startTimeRef = useRef(Date.now())
  const moveRef = useRef<{ from: string; to: string; start: number } | null>(null)
  const activeOrderIdRef = useRef(MOCK_WORK_ORDER.id)

  const steps = useMemo(() => workflowSteps, [])

  const mapPoints: MapPoint[] = [
    ...LANDMARKS,
    { id: 'robot', type: 'robot', label: 'TrayBot', x: robotPos.x, y: robotPos.y },
  ]

  const currentStep = steps[currentStepIndex]
  const currentStepTitle = currentStep?.event.type === 'order_received'
    ? '收到上料工单'
    : (currentStep?.event.title ?? '')
  const activeRoute = getActiveRoute(currentStep)

  const applyStep = useCallback((step: WorkflowStep) => {
    if (step.map.at) {
      const pt = getPoint(step.map.at)
      setRobotPos({ x: pt.x, y: pt.y })
      moveRef.current = null
      setRobotStatus((prev) => ({ ...prev, mode: 'operating', speed: 0 }))
    } else if (step.map.move) {
      moveRef.current = { ...step.map.move, start: Date.now() }
      setRobotStatus((prev) => ({ ...prev, mode: 'navigating', speed: 0.35 }))
    }
  }, [])

  const completeCurrentOrder = useCallback(() => {
    setWorkOrders((prev) => {
      const updated = prev.map((o) =>
        o.id === activeOrderIdRef.current
          ? { ...o, status: 'completed' as const, deliveredTrays: o.totalTrays }
          : o,
      )
      const nextPending = updated.find((o) => o.status === 'pending')
      if (nextPending) {
        activeOrderIdRef.current = nextPending.id
        return normalizeWorkOrderQueue(
          updated.map((o) =>
            o.id === nextPending.id ? { ...o, status: 'in_progress' as const } : o,
          ),
        )
      }
      return updated
    })
  }, [])

  const emitStep = useCallback((index: number) => {
    const step = steps[index]
    if (!step) return

    setCurrentStepIndex(index)
    applyStep(step)

    if (step.event.type === 'order_received') {
      setRobotStatus((prev) => ({ ...prev, taskId: activeOrderIdRef.current, mode: 'operating' }))
      return
    }

    const event: LiveEvent = {
      ...step.event,
      id: `evt-${Date.now()}-${index}`,
      timestamp: new Date(),
    }
    setLiveEvents((prev) => [...prev, event].slice(-40))

    if (step.event.type === 'put_shelf_success') {
      const delivered = parseDelivered(step.event.description)
      if (delivered !== null) {
        setWorkOrders((prev) =>
          prev.map((o) =>
            o.id === activeOrderIdRef.current ? { ...o, deliveredTrays: delivered } : o,
          ),
        )
      }
    }
  }, [steps, applyStep])

  useEffect(() => {
    if (!enabled) return
    let index = 0
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false

    const scheduleNext = () => {
      if (cancelled) return
      timer = setTimeout(() => {
        index += 1
        if (index < steps.length) {
          emitStep(index)
          scheduleNext()
        } else {
          completeCurrentOrder()
          setRobotStatus((prev) => ({ ...prev, mode: 'idle', taskId: null, speed: 0 }))
          moveRef.current = null
          const home = getPoint('home')
          setRobotPos({ x: home.x, y: home.y })

          timer = setTimeout(() => {
            if (cancelled) return
            index = 0
            setLiveEvents([])
            emitStep(0)
            scheduleNext()
          }, CYCLE_COOLDOWN)
        }
      }, EVENT_INTERVAL)
    }

    emitStep(0)
    scheduleNext()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [emitStep, steps, completeCurrentOrder, enabled])

  // 模拟新工单接入，从底部弹入工单池
  useEffect(() => {
    if (!enabled) return
    let seq = 3
    const timer = setInterval(() => {
      seq += 1
      const id = `WO-20260629-${String(seq).padStart(3, '0')}`
      setWorkOrders((prev) =>
        normalizeWorkOrderQueue([
          ...prev,
          {
            id,
            totalTrays: 15 + Math.floor(Math.random() * 25),
            deliveredTrays: 0,
            pickup: `取料货架 A-0${Math.floor(Math.random() * 5) + 1}`,
            delivery: `送料货架 B-0${Math.floor(Math.random() * 9) + 1}`,
            status: 'pending' as const,
          },
        ]),
      )
    }, 30000)
    return () => clearInterval(timer)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    let animFrame: number
    const tick = () => {
      const move = moveRef.current
      if (move) {
        const progress = Math.min((Date.now() - move.start) / EVENT_INTERVAL, 1)
        const from = getPoint(move.from)
        const to = getPoint(move.to)
        setRobotPos({ x: lerp(from.x, to.x, progress), y: lerp(from.y, to.y, progress) })
        if (progress >= 1) {
          moveRef.current = null
          setRobotStatus((prev) => ({ ...prev, mode: 'operating', speed: 0 }))
        }
      }
      animFrame = requestAnimationFrame(tick)
    }
    animFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrame)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const tick = setInterval(() => {
      setRobotStatus((prev) => ({
        ...prev,
        battery: Math.max(20, prev.battery - 0.005),
        cpuTemp: 50 + Math.sin(Date.now() / 3000) * 3,
        joints: prev.joints.map((j) => ({
          ...j,
          temperature: j.temperature + (Math.random() - 0.5) * 0.2,
          angle: j.angle + (Math.random() - 0.5) * 0.5,
        })),
        networkLatency: 10 + Math.floor(Math.random() * 8),
      }))
    }, 2000)
    return () => clearInterval(tick)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const h = Math.floor(elapsed / 3600000)
      const m = Math.floor((elapsed % 3600000) / 60000)
      const s = Math.floor((elapsed % 60000) / 1000)
      setRobotStatus((prev) => ({
        ...prev,
        uptime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      }))
    }, 1000)
    return () => clearInterval(timer)
  }, [enabled])

  return { robotStatus, mapPoints, liveEvents, workOrders, currentStepTitle, activeRoute, thinkingLiveId: null as string | null }
}
