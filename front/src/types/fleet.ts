import type { RobotMode, WorkOrderStatus } from './index'

/** 作业角色：拆包→库房 / 库房→产线 */
export type FleetRole = 'inbound' | 'outbound'

/** 车间区域 */
export type WorkshopZone = 'unpack' | 'warehouse' | 'smt_line' | 'charge'

export type FleetRobotStatus =
  | 'idle'
  | 'navigating'
  | 'operating'
  | 'queued'
  | 'blocked'
  | 'error'
  | 'offline'

export interface FleetWorkOrder {
  id: string
  role: FleetRole
  title: string
  pickup: string
  delivery: string
  totalTrays: number
  deliveredTrays: number
  status: WorkOrderStatus
  assigneeRobotId: string | null
  priority: 'P1' | 'P2' | 'P3'
  eta?: string
}

export interface FleetRobot {
  id: string
  name: string
  role: FleetRole
  zone: WorkshopZone
  status: FleetRobotStatus
  mode: RobotMode
  battery: number
  speed: number
  online: boolean
  /** 平面图百分比坐标 0–100 */
  x: number
  y: number
  currentStep: string
  taskId: string | null
  orderId: string | null
  progress: number
  progressLabel: string
  color: string
}

export interface FleetKpis {
  online: number
  total: number
  inboundBusy: number
  outboundBusy: number
  activeOrders: number
  todayDelivered: number
}

export const ROLE_LABEL: Record<FleetRole, string> = {
  inbound: '拆包→库房',
  outbound: '库房→产线',
}

export const ZONE_LABEL: Record<WorkshopZone, string> = {
  unpack: '卷盘拆包区',
  warehouse: 'SMT 电子库',
  smt_line: 'SMT 产线',
  charge: '充电待命',
}

export const STATUS_LABEL: Record<FleetRobotStatus, string> = {
  idle: '空闲',
  navigating: '导航中',
  operating: '作业中',
  queued: '排队中',
  blocked: '受阻',
  error: '故障',
  offline: '离线',
}
