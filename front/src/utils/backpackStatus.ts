import type { LiveEvent, WorkOrder } from '../types'

/** 从描述中解析「背包现有 X/Y」或「背包剩余 X/Y」 */
function parseBackpackFromDescription(desc: string | undefined): number | null {
  if (!desc) return null
  const m = desc.match(/背包(?:现有|剩余)\s*(\d+)\//)
  return m ? parseInt(m[1], 10) : null
}

/** 根据图文直播事件推导当前背包内料盘数 */
export function deriveBackpackTrays(events: LiveEvent[]): number {
  let trays = 0
  for (const e of events) {
    const parsed = parseBackpackFromDescription(e.description)
    if (parsed != null) trays = parsed
    if (e.type === 'return_home') trays = 0
  }
  return trays
}

export function getActiveWorkOrder(orders: WorkOrder[]): WorkOrder | null {
  return orders.find((o) => o.status === 'in_progress') ?? null
}

export function getBackpackDisplay(
  orders: WorkOrder[],
  events: LiveEvent[],
  robotBackpackTrays?: number,
) {
  const active = getActiveWorkOrder(orders)
  const capacity = active?.backpackCapacity ?? 20
  const trays = active
    ? (robotBackpackTrays ?? deriveBackpackTrays(events))
    : 0
  return { trays, capacity, active }
}
