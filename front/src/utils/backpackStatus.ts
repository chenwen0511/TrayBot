import type { LiveEvent, WorkOrder } from '../types'

/** 根据图文直播事件推导当前背包内料盘数 */
export function deriveBackpackTrays(events: LiveEvent[]): number {
  let trays = 0
  for (const e of events) {
    if (e.type === 'put_backpack') {
      const m = e.description?.match(/(\d+)\s*盘已装入背包/)
      if (m) trays = parseInt(m[1], 10)
    }
    if (e.type === 'put_shelf_success' || e.type === 'return_home') {
      trays = 0
    }
  }
  return trays
}

export function getActiveWorkOrder(orders: WorkOrder[]): WorkOrder | null {
  return orders.find((o) => o.status === 'in_progress') ?? null
}

export function getBackpackDisplay(orders: WorkOrder[], events: LiveEvent[]) {
  const active = getActiveWorkOrder(orders)
  const capacity = active?.backpackCapacity ?? 20
  const trays = active ? deriveBackpackTrays(events) : 0
  return { trays, capacity, active }
}
