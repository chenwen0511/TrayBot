import { Home, MapPin, Package, Truck } from 'lucide-react'
import type { ActiveRoute } from '../mock/useMockDashboard'
import type { MapPoint } from '../types'

interface FloorMapProps {
  points: MapPoint[]
  currentStepTitle?: string
  activeRoute?: ActiveRoute
}

const pointStyles: Record<MapPoint['type'], { color: string; icon: typeof Home }> = {
  home: { color: '#6366f1', icon: Home },
  pickup: { color: '#f59e0b', icon: Package },
  delivery: { color: '#10b981', icon: Truck },
  robot: { color: '#00d4aa', icon: MapPin },
}

const ROUTES: { id: ActiveRoute; x1: number; y1: number; x2: number; y2: number }[] = [
  { id: 'home-pickup', x1: 80, y1: 320, x2: 200, y2: 80 },
  { id: 'pickup-delivery', x1: 200, y1: 80, x2: 520, y2: 80 },
  { id: 'delivery-home', x1: 520, y1: 80, x2: 80, y2: 320 },
  { id: 'delivery-pickup', x1: 520, y1: 80, x2: 200, y2: 80 },
]

export default function FloorMap({ points, currentStepTitle, activeRoute }: FloorMapProps) {
  const robot = points.find((p) => p.type === 'robot')
  const landmarks = points.filter((p) => p.type !== 'robot')

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wider shrink-0">地图导航</h2>
        {currentStepTitle && (
          <span className="text-xs text-accent truncate">{currentStepTitle}</span>
        )}
      </div>

      <div className="px-4 py-1.5 border-b border-border/50 flex items-center gap-3 overflow-x-auto">
        {landmarks.map((point) => {
          const style = pointStyles[point.type]
          const Icon = style.icon
          return (
            <div key={point.id} className="flex items-center gap-1.5 shrink-0">
              <Icon className="w-3 h-3" style={{ color: style.color }} />
              <span className="text-xs text-text-dim">{point.label}</span>
            </div>
          )
        })}
      </div>

      <div className="flex-1 p-3 min-h-0">
        <div className="h-full relative rounded-lg border border-border bg-surface-3 overflow-hidden">
          <svg viewBox="0 0 600 380" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2d3a4f" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="600" height="380" fill="url(#grid)" />

            <rect x="30" y="30" width="540" height="320" rx="8" fill="none" stroke="#2d3a4f" strokeWidth="2" strokeDasharray="8 4" />
            <text x="300" y="20" textAnchor="middle" fill="#64748b" fontSize="11">工作区域 · Floor Plan</text>

            {ROUTES.map((route) => {
              const isActive = activeRoute === route.id
              return (
                <line
                  key={route.id}
                  x1={route.x1}
                  y1={route.y1}
                  x2={route.x2}
                  y2={route.y2}
                  stroke={isActive ? '#00d4aa' : '#334155'}
                  strokeWidth={isActive ? 4 : 3}
                  strokeDasharray={isActive ? 'none' : '6 4'}
                  opacity={isActive ? 0.9 : 0.6}
                />
              )
            })}

            {landmarks.map((point) => {
              const style = pointStyles[point.type]
              const isActive =
                (activeRoute === 'home-pickup' && (point.id === 'home' || point.id === 'pickup')) ||
                (activeRoute === 'pickup-delivery' && (point.id === 'pickup' || point.id === 'delivery')) ||
                (activeRoute === 'delivery-home' && (point.id === 'delivery' || point.id === 'home')) ||
                (activeRoute === 'delivery-pickup' && (point.id === 'delivery' || point.id === 'pickup')) ||
                (!activeRoute && robot &&
                  Math.hypot(robot.x - point.x, robot.y - point.y) < 15)

              return (
                <g key={point.id}>
                  <circle cx={point.x} cy={point.y} r="18" fill={style.color} opacity={isActive ? 0.3 : 0.15} />
                  <circle cx={point.x} cy={point.y} r="8" fill={style.color} opacity={isActive ? 1 : 0.8} />
                  <circle cx={point.x} cy={point.y} r="3" fill="white" />
                  <text x={point.x} y={point.y + 28} textAnchor="middle" fill={isActive ? '#e2e8f0' : '#94a3b8'} fontSize="10">
                    {point.label}
                  </text>
                </g>
              )
            })}

            {robot && (
              <g>
                <circle cx={robot.x} cy={robot.y} r="22" fill="#00d4aa" opacity="0.2">
                  <animate attributeName="r" values="18;26;18" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={robot.x} cy={robot.y} r="12" fill="#00d4aa" stroke="#0f1419" strokeWidth="2" />
                <polygon
                  points={`${robot.x},${robot.y - 8} ${robot.x + 6},${robot.y + 5} ${robot.x - 6},${robot.y + 5}`}
                  fill="white"
                />
                <text x={robot.x} y={robot.y - 18} textAnchor="middle" fill="#00d4aa" fontSize="10" fontWeight="bold">
                  TrayBot
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  )
}
