import { AlertTriangle, FileText, Settings, User } from 'lucide-react'

const APP_LOGO = '/images/app-logo.png'

export default function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-surface-2 shrink-0">
      <div className="flex items-center gap-3">
        <img
          src={APP_LOGO}
          alt="TrayBot"
          className="w-9 h-9 object-contain shrink-0"
        />
        <h1 className="text-base font-bold tracking-tight text-text">
          SMT上下料系统监控中心
        </h1>
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
