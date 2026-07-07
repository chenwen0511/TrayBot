import { useEffect, useMemo, useRef } from 'react'
import type { WorkOrder, WorkOrderStatus } from '../types'

interface TaskExecutionListProps {
  orders: WorkOrder[]
  robotName?: string
}

const statusConfig: Record<WorkOrderStatus, { label: string; badge: string; bar: string; card: string }> = {
  pending: {
    label: '排队中',
    badge: 'bg-green-500/15 text-green-400 border-green-500/35',
    bar: 'bg-green-500',
    card: 'border-green-500/25 bg-green-500/5',
  },
  in_progress: {
    label: '执行中',
    badge: 'bg-red-500/15 text-red-400 border-red-500/35',
    bar: 'bg-red-500',
    card: 'border-red-500/30 bg-red-500/5',
  },
  completed: {
    label: '已完成',
    badge: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
    bar: 'bg-zinc-500',
    card: 'border-border bg-surface-3/30 opacity-70',
  },
}

function taskTitle(order: WorkOrder): string {
  const pickup = order.pickup.replace(/^取料货架\s*/, '')
  const delivery = order.delivery.replace(/^送料货架\s*/, '')
  return `${pickup} → ${delivery} 搬运`
}

function TaskRow({ order, robotName }: { order: WorkOrder; robotName: string }) {
  const cfg = statusConfig[order.status]
  const progress = order.totalTrays > 0
    ? Math.round((order.deliveredTrays / order.totalTrays) * 100)
    : 0

  return (
    <div className={`p-2.5 rounded-lg border transition-colors ${cfg.card}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text truncate">{taskTitle(order)}</p>
          <p className="text-[10px] text-text-dim mt-0.5">
            {robotName} · {order.id}
          </p>
        </div>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
          style={{ width: `${order.status === 'completed' ? 100 : progress}%` }}
        />
      </div>
      <p className="text-[10px] text-text-dim mt-1 text-right">
        {order.status === 'completed' ? '100%' : `${progress}%`}
        {' · '}
        {order.deliveredTrays}/{order.totalTrays} 盘
      </p>
    </div>
  )
}

export default function TaskExecutionList({ orders, robotName = 'Robot T-01' }: TaskExecutionListProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(() => {
    const completed = orders.filter((o) => o.status === 'completed')
    const active = orders.filter((o) => o.status === 'in_progress')
    const pending = orders.filter((o) => o.status === 'pending')
    return [...completed, ...active, ...pending]
  }, [orders])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [sorted.length, sorted.map((o) => `${o.id}-${o.status}`).join(',')])

  return (
    <div ref={listRef} className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
      {sorted.length === 0 ? (
        <p className="text-xs text-text-dim text-center py-6">暂无任务</p>
      ) : (
        sorted.map((order) => (
          <TaskRow key={order.id} order={order} robotName={robotName} />
        ))
      )}
    </div>
  )
}
