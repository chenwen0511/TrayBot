import { useState } from 'react'
import { Keyboard, MapPin, Pause, Play, X, Zap } from 'lucide-react'

export default function NavigationControl() {
  const [navMode, setNavMode] = useState<'single' | 'charge' | 'keyboard'>('single')

  const btnBase = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors'
  const btnInactive = 'bg-surface-3 border border-border text-text-dim hover:border-accent/40 hover:text-text'
  const btnActive = 'bg-accent text-white shadow-sm shadow-accent/20'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <button type="button" onClick={() => setNavMode('single')} className={`${btnBase} ${navMode === 'single' ? btnActive : btnInactive}`}>
          <MapPin className="w-4 h-4" />
          单点导航
        </button>
        <button type="button" onClick={() => setNavMode('charge')} className={`${btnBase} ${navMode === 'charge' ? btnActive : btnInactive}`}>
          <Zap className="w-4 h-4" />
          自动回充
        </button>
        <button type="button" onClick={() => setNavMode('keyboard')} className={`${btnBase} ${navMode === 'keyboard' ? btnActive : btnInactive}`}>
          <Keyboard className="w-4 h-4" />
          启用键盘遥控
        </button>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button type="button" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium bg-surface-3 border border-border text-text-dim hover:border-success/40 hover:text-success transition-colors">
          <Play className="w-3.5 h-3.5" />
          继续
        </button>
        <button type="button" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium bg-surface-3 border border-border text-text-dim hover:border-warn/40 hover:text-warn transition-colors">
          <Pause className="w-3.5 h-3.5" />
          暂停
        </button>
        <button type="button" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 transition-colors">
          <X className="w-3.5 h-3.5" />
          取消
        </button>
      </div>
    </div>
  )
}
