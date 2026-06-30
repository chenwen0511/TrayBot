export type RobotMode = 'idle' | 'navigating' | 'operating' | 'charging' | 'error'

export interface JointStatus {
  id: string
  name: string
  temperature: number
  angle: number
}

export interface RobotStatus {
  name: string
  mode: RobotMode
  battery: number
  batteryVoltage: number
  cpuTemp: number
  speed: number
  uptime: string
  taskId: string | null
  joints: JointStatus[]
  networkLatency: number
  signalStrength: number
}

export interface CameraStream {
  id: string
  label: string
  src: string
  resolution: string
  fps: number
  online: boolean
}

export type MapPointType = 'home' | 'pickup' | 'delivery' | 'robot'

export interface MapPoint {
  id: string
  type: MapPointType
  label: string
  x: number
  y: number
}

export type LiveEventType =
  | 'order_received'
  | 'nav_to_pickup'
  | 'arrived_pickup'
  | 'target_locked'
  | 'grab_success'
  | 'put_backpack'
  | 'nav_to_delivery'
  | 'arrived_delivery'
  | 'taking_out'
  | 'put_shelf_success'
  | 'batch_decision'
  | 'return_home'

export interface LiveEvent {
  id: string
  type: LiveEventType
  title: string
  description?: string
  thinking?: string
  timestamp: Date
}

export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed'

export interface WorkOrder {
  id: string
  totalTrays: number
  deliveredTrays: number
  pickup: string
  delivery: string
  status: WorkOrderStatus
}
