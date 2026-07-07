import { useMemo, useState } from 'react'
import {
  Crosshair,
  Eye,
  EyeOff,
  Layers,
  MapPin,
  MoreHorizontal,
  MousePointer2,
  Navigation,
  PenLine,
  RefreshCw,
  Route,
  Square,
} from 'lucide-react'
import type { ActiveRoute } from '../mock/useMockDashboard'
import type { MapPoint } from '../types'
import type { MapConfig } from '../types/map'
import { resolveRoutes } from '../utils/mapRaster'
import MapStatusOverlay from './MapStatusOverlay'
import VoxelMapLayer from './VoxelMapLayer'
import VoxelMap3D from './VoxelMap3D'

interface MapVisualizationProps {
  mapConfig: MapConfig
  points: MapPoint[]
  currentStepTitle?: string
  activeRoute?: ActiveRoute
  speed?: number
}

const pointStyles: Record<MapPoint['type'], { color: string }> = {
  home: { color: '#6366f1' },
  pickup: { color: '#f59e0b' },
  delivery: { color: '#10b981' },
  robot: { color: '#00d4aa' },
}

const ROUTES_LEGACY = [
  { id: 'home-pickup' as ActiveRoute, x1: 80, y1: 320, x2: 200, y2: 80 },
  { id: 'pickup-delivery' as ActiveRoute, x1: 200, y1: 80, x2: 520, y2: 80 },
  { id: 'delivery-home' as ActiveRoute, x1: 520, y1: 80, x2: 80, y2: 320 },
  { id: 'delivery-pickup' as ActiveRoute, x1: 520, y1: 80, x2: 200, y2: 80 },
]

type LayerKey = 'map' | 'pointCloud' | 'waypoints' | 'path'

export default function MapVisualization({ mapConfig, points, activeRoute, speed = 0 }: MapVisualizationProps) {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d')
  const [navMode, setNavMode] = useState<'nav' | 'mapping'>('nav')
  const [floor, setFloor] = useState<'1F' | '2F'>('1F')
  const [follow, setFollow] = useState(true)
  const [obstacleRay] = useState(true)
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    map: true,
    pointCloud: false,
    waypoints: true,
    path: true,
  })

  const { width, height } = mapConfig.viewBox
  const routes = useMemo(
    () => (mapConfig.regions.length > 0 ? resolveRoutes(mapConfig) : ROUTES_LEGACY),
    [mapConfig],
  )
  const landmarkLabels = useMemo(
    () => new Set(mapConfig.landmarks.map((l) => l.label)),
    [mapConfig.landmarks],
  )
  const shelfLabels = useMemo(
    () => mapConfig.regions.filter((r) => r.label && !landmarkLabels.has(r.label)),
    [mapConfig.regions, landmarkLabels],
  )

  const robot = points.find((p) => p.type === 'robot')
  const landmarks = points.filter((p) => p.type !== 'robot')

  const toggleLayer = (key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-viz-bg relative">
      <div className="flex-1 min-h-0 relative">
        <MapStatusOverlay robot={robot} speed={speed} mapName={mapConfig.name} />

        {/* 地图主视图 */}
        <div className="absolute inset-0 bg-[#050608] overflow-hidden">
          {viewMode === '3d' && mapConfig.blocks && mapConfig.blocks.length > 0 ? (
            <VoxelMap3D
              config={mapConfig}
              points={points}
              activeRoute={activeRoute}
              layers={layers}
              follow={follow}
            />
          ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <rect width={width} height={height} fill="#050608" />

            <VoxelMapLayer config={mapConfig} visible={layers.map} />

            {layers.map && (
              <text x={width / 2} y={18} textAnchor="middle" fill="#64748b" fontSize="11">
                {mapConfig.name} · {floor}
              </text>
            )}

            {shelfLabels.map((r, i) => (
              r.label && (
                <text
                  key={`lbl-${i}`}
                  x={r.x + r.w / 2}
                  y={r.y - 4}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8"
                >
                  {r.label}
                </text>
              )
            ))}

            {layers.path && routes.map((route) => {
              const isActive = activeRoute === route.id
              return (
                <line
                  key={route.id}
                  x1={route.x1}
                  y1={route.y1}
                  x2={route.x2}
                  y2={route.y2}
                  stroke={isActive ? '#00d4aa' : '#334155'}
                  strokeWidth={isActive ? 3 : 2}
                  strokeDasharray={isActive ? 'none' : '6 4'}
                  opacity={isActive ? 0.95 : 0.45}
                />
              )
            })}

            {layers.waypoints && landmarks.map((point) => {
              const style = pointStyles[point.type]
              const isActive =
                (activeRoute === 'home-pickup' && (point.id === 'home' || point.id === 'pickup')) ||
                (activeRoute === 'pickup-delivery' && (point.id === 'pickup' || point.id === 'delivery')) ||
                (activeRoute === 'delivery-home' && (point.id === 'delivery' || point.id === 'home')) ||
                (activeRoute === 'delivery-pickup' && (point.id === 'delivery' || point.id === 'pickup'))

              return (
                <g key={point.id}>
                  <circle cx={point.x} cy={point.y} r="18" fill={style.color} opacity={isActive ? 0.35 : 0.15} />
                  <circle cx={point.x} cy={point.y} r="8" fill={style.color} opacity={isActive ? 1 : 0.75} />
                  <circle cx={point.x} cy={point.y} r="3" fill="white" />
                  <text x={point.x} y={point.y + 28} textAnchor="middle" fill={isActive ? '#e2e8f0' : '#94a3b8'} fontSize="10">
                    {point.label}
                  </text>
                </g>
              )
            })}

            {robot && (
              <g>
                {follow && (
                  <circle cx={robot.x} cy={robot.y} r="22" fill="#00d4aa" opacity="0.18">
                    <animate attributeName="r" values="18;26;18" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={robot.x} cy={robot.y} r="12" fill="#00d4aa" stroke="#0a0c10" strokeWidth="2" />
                <polygon
                  points={`${robot.x},${robot.y - 8} ${robot.x + 6},${robot.y + 5} ${robot.x - 6},${robot.y + 5}`}
                  fill="white"
                />
                {obstacleRay && (
                  <line x1={robot.x} y1={robot.y} x2={robot.x + 40} y2={robot.y - 30} stroke="#00d4aa" strokeWidth="1.5" opacity="0.6" strokeDasharray="4 2" />
                )}
              </g>
            )}

            {layers.pointCloud && (
              <>
                {Array.from({ length: 80 }, (_, i) => (
                  <circle
                    key={i}
                    cx={40 + (i * 17) % (width - 80)}
                    cy={40 + (i * 23) % (height - 80)}
                    r="1.2"
                    fill={i % 3 === 0 ? '#ff6ec7' : '#00e5c0'}
                    opacity="0.45"
                  />
                ))}
              </>
            )}
          </svg>
          )}
        </div>

        {/* 右侧浮层工具栏（图二风格） */}
        <div className="absolute right-2 top-12 z-10 w-[72px] rounded-lg bg-[#12161e]/92 border border-white/[0.08] backdrop-blur-sm p-1 flex flex-col gap-0.5">
          {(['2d', '3d'] as const).map((m) => (
            <SidePanelBtn
              key={m}
              label={m.toUpperCase()}
              active={viewMode === m}
              onClick={() => setViewMode(m)}
              compact
            />
          ))}
          <div className="h-px bg-white/[0.06] my-0.5" />
          <SidePanelBtn
            icon={Navigation}
            label="导航模式"
            active={navMode === 'nav'}
            onClick={() => setNavMode('nav')}
          />
          <SidePanelBtn
            icon={PenLine}
            label="建图模式"
            active={navMode === 'mapping'}
            onClick={() => setNavMode('mapping')}
          />
          <SidePanelBtn
            icon={Layers}
            label="图层"
            active={layers.map && layers.waypoints}
            onClick={() => toggleLayer('map')}
          />
          <div className="h-px bg-white/[0.06] my-0.5" />
          {(['1F', '2F'] as const).map((f) => (
            <SidePanelBtn
              key={f}
              label={f}
              active={floor === f}
              onClick={() => setFloor(f)}
              compact
            />
          ))}
        </div>

        {/* 底部浮层工具栏（图二风格） */}
        <div className="absolute bottom-2 left-2 right-2 z-10 rounded-lg bg-[#12161e]/92 border border-white/[0.08] backdrop-blur-sm px-2.5 py-1.5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-white/45 mb-1">地图操作</p>
            <div className="flex items-center">
              <MapActionBtn icon={RefreshCw} label="复位" onClick={() => {}} />
              <MapActionBtn
                icon={Crosshair}
                label="视角跟随"
                active={follow}
                onClick={() => setFollow((v) => !v)}
              />
              <MapActionBtn icon={MousePointer2} label="标记导航" onClick={() => {}} />
              <MapActionBtn icon={MapPin} label="标记点位" onClick={() => {}} />
              <MapActionBtn icon={Square} label="设置区域" onClick={() => {}} />
              <MapActionBtn icon={Route} label="设置路线" onClick={() => {}} />
              <MapActionBtn icon={MoreHorizontal} label="虚拟墙" onClick={() => {}} />
            </div>
          </div>

          <div className="shrink-0">
            <p className="text-[10px] text-white/45 mb-1 text-right">显示控制</p>
            <div className="flex items-center gap-1">
              <DisplayToggleBtn label="地图" active={layers.map} onClick={() => toggleLayer('map')} />
              <DisplayToggleBtn label="点云" active={layers.pointCloud} onClick={() => toggleLayer('pointCloud')} />
              <DisplayToggleBtn label="点位" active={layers.waypoints} onClick={() => toggleLayer('waypoints')} />
              <DisplayToggleBtn label="路径" active={layers.path} onClick={() => toggleLayer('path')} />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function SidePanelBtn({
  icon: Icon,
  label,
  active,
  onClick,
  compact,
}: {
  icon?: typeof Navigation
  label: string
  active?: boolean
  onClick: () => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full py-1 rounded text-[11px] font-medium transition-colors ${
          active
            ? 'bg-accent-teal/20 text-accent-teal border border-accent-teal/40'
            : 'text-white/60 hover:text-white/85 hover:bg-white/[0.04]'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded transition-colors ${
        active
          ? 'text-accent-teal bg-accent-teal/[0.08]'
          : 'text-white/60 hover:text-white/85 hover:bg-white/[0.04]'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" strokeWidth={1.5} />}
      <span className="text-[9px] leading-tight text-center whitespace-nowrap">{label}</span>
    </button>
  )
}

function MapActionBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof RefreshCw
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded min-w-[48px] transition-colors ${
        active
          ? 'text-accent-teal'
          : 'text-white/70 hover:text-accent-teal hover:bg-white/[0.03]'
      }`}
    >
      <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
      <span className="text-[9px] leading-none whitespace-nowrap">{label}</span>
    </button>
  )
}

function DisplayToggleBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  const Icon = active ? Eye : EyeOff
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-colors ${
        active
          ? 'bg-accent-teal text-[#0a0c10] font-medium'
          : 'bg-[#1a1f28]/80 text-white/50 hover:text-white/70 border border-white/[0.08]'
      }`}
    >
      <Icon className="w-3 h-3" strokeWidth={1.75} />
      {label}
    </button>
  )
}
