import { AlertTriangle, ArrowLeft, FileText, Settings, User } from 'lucide-react'

const APP_LOGO = '/images/app-logo.png'

interface HeaderProps {
  title?: string
  robotId?: string
  onBackToFleet?: () => void
}

export default function Header({
  title = 'SMT上下料系统监控中心',
  robotId,
  onBackToFleet,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-surface-2 shrink-0">
      <div className="flex items-center gap-3">
        {onBackToFleet && (
          <button
            type="button"
            onClick={onBackToFleet}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-text-dim hover:text-accent hover:bg-surface-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            车间总览
          </button>
        )}
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
          <img
            src={APP_LOGO}
            alt="TrayBot"
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-text">{title}</h1>
          {robotId && (
            <p className="text-[10px] text-text-dim font-mono">{robotId} · 单机作业详情</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="px-4 py-1.5 rounded-md bg-danger text-white text-sm font-bold hover:bg-red-600 transition-colors"
        >
          急停 E-STOP
        </button>

        <button type="button" className="flex items-center gap-1.5 text-sm text-text-dim hover:text-warn transition-colors">
          <AlertTriangle className="w-4 h-4 text-warn" />
          告警
        </button>
        <button type="button" className="flex items-center gap-1.5 text-sm text-text-dim hover:text-accent transition-colors">
          <FileText className="w-4 h-4" />
          日志
        </button>
        <button type="button" className="flex items-center gap-1.5 text-sm text-text-dim hover:text-accent transition-colors">
          <Settings className="w-4 h-4" />
          设置
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <span className="text-sm text-text-dim">admin</span>
          <div className="w-8 h-8 rounded-full bg-surface-3 border border-border flex items-center justify-center">
            <User className="w-4 h-4 text-text-dim" />
          </div>
        </div>
      </div>
    </header>
  )
}
