import { useMemo } from 'react'
import { Wifi } from 'lucide-react'
import PanelCard from './PanelCard'
import CameraStrip from './CameraStrip'
import type { CameraStream, LiveEvent, RobotStatus, WorkOrder } from '../types'
import { getBackpackDisplay } from '../utils/backpackStatus'

const ROBOT_LOGO = '/images/robot-logo.png'

interface LeftSidebarProps {
  robot: RobotStatus
  cameras: CameraStream[]
  workOrders: WorkOrder[]
  liveEvents: LiveEvent[]
}

function BatteryDonut({ value }: { value: number }) {
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  const color = value > 50 ? '#22c55e' : value > 20 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#2a3344" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold font-mono text-text">{value.toFixed(0)}%</span>
        <span className="text-[10px] text-text-dim">电量</span>
      </div>
    </div>
  )
}

export default function LeftSidebar({ robot, cameras, workOrders, liveEvents }: LeftSidebarProps) {
  const modeLabel =
    robot.mode === 'operating' ? '任务中' :
    robot.mode === 'navigating' ? '导航中' :
    robot.mode === 'idle' ? '待命中' :
    robot.mode === 'charging' ? '充电中' : '异常'

  const { trays, capacity } = useMemo(
    () => getBackpackDisplay(workOrders, liveEvents),
    [workOrders, liveEvents],
  )

  return (
    <aside className="w-[268px] shrink-0 flex flex-col gap-2 py-2 pl-2 pr-0 bg-surface overflow-y-auto min-h-0">
      <PanelCard title="机器人状态">
        <div className="flex gap-3">
          <div className="w-20 h-20 shrink-0 rounded-md bg-[#2a3140] flex items-center justify-center overflow-hidden p-1">
            <img
              src={ROBOT_LOGO}
              alt="TrayBot"
              className="w-full h-full object-contain drop-shadow-sm"
              onError={(e) => {
                const t = e.currentTarget
                if (!t.dataset.retried) {
                  t.dataset.retried = '1'
                  t.src = `${ROBOT_LOGO}?v=${Date.now()}`
                }
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm font-medium text-text">在线</span>
              <span className="text-xs text-text-dim">(ID: T-01)</span>
            </div>
            <p className="text-xs text-text-dim">
              作业状态: <span className="text-accent font-medium">{modeLabel}</span>
            </p>
            <p className="text-xs text-text-dim mt-1">
              料盘：{' '}
              <span className="font-mono font-medium text-text">
                {trays}/{capacity}
              </span>
            </p>
            {robot.taskId && (
              <p className="text-[10px] text-text-dim/70 mt-1 truncate">{robot.taskId}</p>
            )}
          </div>
        </div>
      </PanelCard>

      <PanelCard title="系统运行状态">
        <div className="flex items-center gap-4">
          <BatteryDonut value={robot.battery} />
          <div className="flex-1 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-dim">电压</span>
              <span className="font-mono font-medium text-text">{robot.batteryVoltage.toFixed(1)} V</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">网络</span>
              <span className="font-mono font-medium text-text flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                WIFI ({robot.networkLatency}ms)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">电机</span>
              <span className="font-medium text-success">
                {Math.max(...robot.joints.map((j) => j.temperature)).toFixed(0)}°C 正常
              </span>
            </div>
          </div>
        </div>
      </PanelCard>

      <PanelCard bare className="flex-1 min-h-0">
        <CameraStrip cameras={cameras} />
      </PanelCard>
    </aside>
  )
}
