import { useEffect, useMemo, useState } from 'react'
import { fleetOrders, fleetRobots, getFleetKpis } from '../mock/fleet'
import FleetOrderPanel from '../components/fleet/FleetOrderPanel'
import FleetRobotList from '../components/fleet/FleetRobotList'
import WorkshopMap from '../components/fleet/WorkshopMap'
import { ROLE_LABEL, STATUS_LABEL, type FleetRobot } from '../types/fleet'

interface Props {
  onOpenRobot: (robotId: string) => void
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function FleetOverview({ onOpenRobot }: Props) {
  const [robots, setRobots] = useState(fleetRobots)
  const [selectedId, setSelectedId] = useState<string | null>(fleetRobots[0]?.id ?? null)
  const [clock, setClock] = useState('--:--:--')

  const kpis = useMemo(() => getFleetKpis(robots, fleetOrders), [robots])
  const selected = robots.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // 轻量模拟：导航中机器人位置微调
  useEffect(() => {
    const t = setInterval(() => {
      setRobots((prev) =>
        prev.map((r) => {
          if (r.status !== 'navigating') return r
          const dx = (Math.random() - 0.5) * 0.8
          const dy = (Math.random() - 0.5) * 0.6
          return {
            ...r,
            x: Math.min(92, Math.max(8, r.x + dx)),
            y: Math.min(90, Math.max(8, r.y + dy)),
            progress: Math.min(99, r.progress + Math.random() * 0.4),
          }
        }),
      )
    }, 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Top bar — demo KPI strip adapted to dark theme */}
      <header className="shrink-0 px-4 py-2.5 border-b border-border bg-surface-2 flex items-center gap-4">
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-surface-3">
            <img src="/images/app-logo.png" alt="" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold text-text tracking-tight">SMT 车间作业总览</h1>
            <p className="text-[10px] text-text-dim uppercase tracking-wider">Fleet · Unpack ↔ Warehouse ↔ Line</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
          <Kpi label="在线机器人" value={`${kpis.online}/${kpis.total}`} accent />
          <Kpi label="入库忙碌" value={String(kpis.inboundBusy)} />
          <Kpi label="供料忙碌" value={String(kpis.outboundBusy)} />
          <Kpi label="进行中工单" value={String(kpis.activeOrders)} />
          <Kpi label="今日已送盘" value={String(kpis.todayDelivered)} />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-[11px] text-sky-200">
              双链路运行 · 拆包入库 / 产线供料
            </span>
          </div>
          <div className="font-mono text-sm text-text-dim min-w-[72px] text-right">{clock}</div>
        </div>
      </header>

      {/* Main: orders | map | robots */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[300px_1fr_320px] gap-2 p-2">
        <section className="min-h-0 rounded-md bg-surface-2 border border-border overflow-hidden">
          <FleetOrderPanel
            orders={fleetOrders}
            selectedRobotId={selectedId}
            onSelectRobot={setSelectedId}
          />
        </section>

        <section className="min-h-0 flex flex-col gap-2">
          <div className="flex-1 min-h-0">
            <WorkshopMap
              robots={robots}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpenDetail={onOpenRobot}
            />
          </div>
          {selected && <SelectedBar robot={selected} onOpen={() => onOpenRobot(selected.id)} />}
        </section>

        <section className="min-h-0 rounded-md bg-surface-2 border border-border overflow-hidden">
          <FleetRobotList
            robots={robots}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenDetail={onOpenRobot}
          />
        </section>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[88px] px-3 py-1.5 rounded-lg bg-surface border border-border">
      <div className="text-[10px] text-text-dim uppercase tracking-wider">{label}</div>
      <div className={`font-mono text-lg font-semibold leading-tight ${accent ? 'text-accent-teal' : 'text-text'}`}>
        {value}
      </div>
    </div>
  )
}

function SelectedBar({ robot, onOpen }: { robot: FleetRobot; onOpen: () => void }) {
  return (
    <div className="shrink-0 rounded-md border border-border bg-surface-2 px-3 py-2 flex items-center gap-3">
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
        style={{ background: robot.color }}
      >
        {robot.id.replace('TrayBot-', '')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-text">
          {robot.name}
          <span className="ml-2 text-[11px] font-normal text-text-dim">
            {ROLE_LABEL[robot.role]} · {STATUS_LABEL[robot.status]}
          </span>
        </div>
        <div className="text-[11px] text-text-dim truncate">{robot.currentStep}</div>
      </div>
      <div className="hidden sm:block text-[11px] font-mono text-text-dim">{robot.progressLabel}</div>
      <button
        type="button"
        onClick={onOpen}
        className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-dim transition-colors"
      >
        进入作业详情
      </button>
    </div>
  )
}
