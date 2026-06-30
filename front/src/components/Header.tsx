import { Activity, Bot, Wifi } from 'lucide-react'
import type { RobotStatus } from '../types'

interface HeaderProps {
  robot: RobotStatus
}

const modeLabels: Record<RobotStatus['mode'], string> = {
  idle: '空闲',
  navigating: '导航中',
  operating: '作业中',
  charging: '充电中',
  error: '异常',
}

const modeColors: Record<RobotStatus['mode'], string> = {
  idle: 'bg-slate-500',
  navigating: 'bg-blue-500',
  operating: 'bg-accent',
  charging: 'bg-yellow-500',
  error: 'bg-danger',
}

export default function Header({ robot }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10 border border-accent/30">
          <Bot className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">TrayBot 监控中心</h1>
          <p className="text-xs text-text-dim">{robot.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-text-dim" />
          <span className="text-sm">{robot.signalStrength}%</span>
          <span className="text-xs text-text-dim">{robot.networkLatency}ms</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${modeColors[robot.mode]} animate-pulse`} />
          <span className="text-sm font-medium">{modeLabels[robot.mode]}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-3 border border-border">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-xs text-text-dim">实时</span>
        </div>
      </div>
    </header>
  )
}
