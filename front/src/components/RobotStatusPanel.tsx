import { useCallback, useState } from 'react'
import {
  Battery,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cpu,
  Gauge,
  Square,
  Thermometer,
} from 'lucide-react'
import type { RobotStatus } from '../types'

interface RobotStatusPanelProps {
  robot: RobotStatus
}

type MoveDirection = 'forward' | 'backward' | 'left' | 'right' | null

const directionLabels: Record<Exclude<MoveDirection, null>, string> = {
  forward: '前进',
  backward: '后退',
  left: '左移',
  right: '右移',
}

function TempBar({ value, max = 80 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value > 60 ? 'bg-danger' : value > 45 ? 'bg-warn' : 'bg-accent'
  return (
    <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function MoveButton({
  label,
  icon: Icon,
  active,
  onPress,
  onRelease,
  variant = 'default',
}: {
  label: string
  icon: typeof ChevronUp
  active?: boolean
  onPress: () => void
  onRelease: () => void
  variant?: 'default' | 'stop'
}) {
  const isStop = variant === 'stop'

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress()
      }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onContextMenu={(e) => e.preventDefault()}
      className={`
        flex items-center justify-center rounded-lg border transition-all select-none touch-none
        ${isStop ? 'w-14 h-14' : 'w-12 h-12'}
        ${active
          ? isStop
            ? 'bg-danger/20 border-danger text-danger scale-95'
            : 'bg-accent/20 border-accent text-accent scale-95'
          : isStop
            ? 'bg-surface-3 border-danger/40 text-danger hover:bg-danger/10 hover:border-danger/60'
            : 'bg-surface-3 border-border text-text-dim hover:bg-surface hover:border-accent/40 hover:text-accent'
        }
      `}
    >
      <Icon className={isStop ? 'w-5 h-5' : 'w-5 h-5'} strokeWidth={isStop ? 2.5 : 2} />
    </button>
  )
}

function MovementControl() {
  const [direction, setDirection] = useState<MoveDirection>(null)

  const startMove = useCallback((dir: MoveDirection) => setDirection(dir), [])
  const stopMove = useCallback(() => setDirection(null), [])

  return (
    <div className="shrink-0 border-t border-border p-4 bg-surface-2">
      <h3 className="text-sm font-medium mb-3 text-center">移动控制</h3>

      <div className="flex flex-col items-center gap-1.5">
        <MoveButton
          label="前进"
          icon={ChevronUp}
          active={direction === 'forward'}
          onPress={() => startMove('forward')}
          onRelease={stopMove}
        />

        <div className="flex items-center gap-1.5">
          <MoveButton
            label="左移"
            icon={ChevronLeft}
            active={direction === 'left'}
            onPress={() => startMove('left')}
            onRelease={stopMove}
          />
          <MoveButton
            label="停止"
            icon={Square}
            variant="stop"
            onPress={stopMove}
            onRelease={() => {}}
          />
          <MoveButton
            label="右移"
            icon={ChevronRight}
            active={direction === 'right'}
            onPress={() => startMove('right')}
            onRelease={stopMove}
          />
        </div>

        <MoveButton
          label="后退"
          icon={ChevronDown}
          active={direction === 'backward'}
          onPress={() => startMove('backward')}
          onRelease={stopMove}
        />
      </div>

      <p className="mt-3 text-center text-xs text-text-dim">
        {direction ? (
          <span className="text-accent font-medium">正在{directionLabels[direction]}...</span>
        ) : (
          '按住方向键移动，点击停止'
        )}
      </p>
    </div>
  )
}

export default function RobotStatusPanel({ robot }: RobotStatusPanelProps) {
  const batteryColor =
    robot.battery > 50 ? 'text-accent' : robot.battery > 20 ? 'text-warn' : 'text-danger'

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wider">本体状态</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="p-3 rounded-lg bg-surface-3 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Battery className={`w-4 h-4 ${batteryColor}`} />
              <span className="text-sm">电量</span>
            </div>
            <span className={`text-xl font-bold font-mono ${batteryColor}`}>{robot.battery.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                robot.battery > 50 ? 'bg-accent' : robot.battery > 20 ? 'bg-warn' : 'bg-danger'
              }`}
              style={{ width: `${robot.battery}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-text-dim">{robot.batteryVoltage.toFixed(1)} V</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-surface-3 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Cpu className="w-3.5 h-3.5 text-text-dim" />
              <span className="text-xs text-text-dim">CPU 温度</span>
            </div>
            <p className="text-lg font-mono font-semibold">{robot.cpuTemp.toFixed(0)}°C</p>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-3 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className="w-3.5 h-3.5 text-text-dim" />
              <span className="text-xs text-text-dim">移动速度</span>
            </div>
            <p className="text-lg font-mono font-semibold">{robot.speed.toFixed(2)} m/s</p>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-surface-3 border border-border">
          <span className="text-xs text-text-dim">运行时长</span>
          <p className="text-lg font-mono font-semibold">{robot.uptime}</p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="w-4 h-4 text-text-dim" />
            <h3 className="text-sm font-medium">关节温度</h3>
          </div>
          <div className="space-y-2.5">
            {robot.joints.map((joint) => (
              <div key={joint.id} className="flex items-center gap-3">
                <span className="w-12 text-xs text-text-dim shrink-0">{joint.name}</span>
                <TempBar value={joint.temperature} />
                <span className="w-10 text-xs font-mono text-right shrink-0">
                  {joint.temperature.toFixed(0)}°
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">关节角度</h3>
          <div className="grid grid-cols-3 gap-2">
            {robot.joints.map((joint) => (
              <div key={joint.id} className="p-2 rounded bg-surface-3 border border-border text-center">
                <p className="text-xs text-text-dim">{joint.name}</p>
                <p className="text-sm font-mono font-medium">{joint.angle.toFixed(1)}°</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MovementControl />
    </div>
  )
}
