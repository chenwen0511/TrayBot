import { useEffect, useMemo, useRef } from 'react'
import { ClipboardList } from 'lucide-react'
import type { WorkOrder, WorkOrderStatus } from '../types'

interface WorkOrderPoolProps {
  orders: WorkOrder[]
}

const statusConfig: Record<WorkOrderStatus, { label: string; className: string; dot: string }> = {
  pending: {
    label: '排队中',
    className: 'border-green-500/40 bg-green-500/5 text-green-400',
    dot: 'bg-green-500',
  },
  in_progress: {
    label: '进行中',
    className: 'border-red-500/40 bg-red-500/5 text-red-400',
    dot: 'bg-red-500 animate-pulse',
  },
  completed: {
    label: '已完成',
    className: 'border-border bg-surface-3/50 text-text-dim opacity-60',
    dot: 'bg-text-dim/40',
  },
}

function OrderCard({ order, statusLabel }: { order: WorkOrder; statusLabel?: string }) {
  const cfg = statusConfig[order.status]
  const label = statusLabel ?? cfg.label
  const progress = order.totalTrays > 0
    ? Math.round((order.deliveredTrays / order.totalTrays) * 100)
    : 0

  return (
    <div className={`px-2.5 py-2 rounded-lg border ${cfg.className}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
          <span className="text-xs font-mono font-medium truncate">{order.id}</span>
        </div>
        <span className="text-[10px] shrink-0">{label}</span>
      </div>
      <p className="text-[10px] text-text-dim/80 truncate">
        {order.pickup} → {order.delivery}
      </p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-text-dim/60">
          {order.deliveredTrays}/{order.totalTrays} 盘
        </span>
        {order.status === 'in_progress' && (
          <span className="text-[10px] font-mono">{progress}%</span>
        )}
      </div>
      {order.status === 'in_progress' && (
        <div className="mt-1.5 h-1 rounded-full bg-surface overflow-hidden">
          <div
            className="h-full bg-red-500/70 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function WorkOrderPool({ orders }: WorkOrderPoolProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const { completed, activeOrder, pendingQueue } = useMemo(() => {
    const completed = orders.filter((o) => o.status === 'completed')
    const activeOrder = orders.find((o) => o.status === 'in_progress') ?? null
    const pendingQueue = orders.filter((o) => o.status === 'pending')
    return { completed, activeOrder, pendingQueue }
  }, [orders])

  const scrollKey = [
    orders.length,
    activeOrder?.id,
    pendingQueue.map((o) => o.id).join(','),
    completed.length,
  ].join('|')

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [scrollKey])

  return (
    <div className="h-full bg-surface-2 flex flex-col min-h-0">
      <div className="px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-text-dim" />
          <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wider">工单池</h2>
        </div>
        <span className="text-xs text-text-dim">{orders.length} 单</span>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 flex flex-col">
        {/* 已完成 — 置顶 */}
        {completed.length > 0 && (
          <div className="space-y-1.5 shrink-0">
            {completed.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}

        {/* 进行中 — 同时仅一条 */}
        {activeOrder && (
          <div className={`shrink-0 ${completed.length > 0 ? 'mt-1.5' : ''}`}>
            <OrderCard order={activeOrder} />
          </div>
        )}

        {/* 排队中 — 按 FIFO 从底部弹入 */}
        {pendingQueue.length > 0 && (
          <div className="mt-auto pt-1.5 space-y-1.5">
            {pendingQueue.map((order, i) => (
              <div
                key={order.id}
                className={i === pendingQueue.length - 1 ? 'animate-slide-up' : undefined}
              >
                <OrderCard
                  order={order}
                  statusLabel={i === pendingQueue.length - 1 ? '新接到' : '排队中'}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
