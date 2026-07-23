import { ROLE_LABEL, STATUS_LABEL, ZONE_LABEL, type FleetRobot, type FleetRole } from '../../types/fleet'

interface Props {
  robots: FleetRobot[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenDetail: (id: string) => void
}

const statusColor: Record<string, string> = {
  idle: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  navigating: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  operating: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  queued: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  blocked: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  error: 'bg-red-500/15 text-red-300 border-red-500/30',
  offline: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

function RobotCard({
  robot,
  selected,
  onSelect,
  onOpenDetail,
}: {
  robot: FleetRobot
  selected: boolean
  onSelect: () => void
  onOpenDetail: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onOpenDetail}
      className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
        selected
          ? 'bg-surface-3 border-accent/50 ring-1 ring-accent/30'
          : 'bg-surface-2 border-border hover:border-accent/40'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{ background: robot.color }}
        >
          {robot.id.replace('TrayBot-', '')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-text truncate">{robot.name}</div>
          <div className="text-[10px] text-text-dim truncate">{ROLE_LABEL[robot.role]}</div>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${statusColor[robot.status]}`}>
          {STATUS_LABEL[robot.status]}
        </span>
      </div>
      <div className="text-[11px] text-text-dim mb-1.5 truncate">{robot.currentStep}</div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-text-dim mb-1">
        <span>{ZONE_LABEL[robot.zone]}</span>
        <span className="font-mono">{robot.battery}%</span>
      </div>
      <div className="h-1 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${robot.progress}%`,
            background: `linear-gradient(90deg, ${robot.color}, #00d4aa)`,
          }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] text-text-dim font-mono">{robot.progressLabel}</span>
        <span
          role="link"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onOpenDetail()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation()
              onOpenDetail()
            }
          }}
          className="text-[10px] text-accent hover:underline cursor-pointer"
        >
          作业详情 →
        </span>
      </div>
    </button>
  )
}

export default function FleetRobotList({ robots, selectedId, onSelect, onOpenDetail }: Props) {
  const groups: { role: FleetRole; label: string }[] = [
    { role: 'inbound', label: '入库链路 · 拆包→库房' },
    { role: 'outbound', label: '供料链路 · 库房→产线' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">机队状态</h2>
        <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">
          {robots.filter((r) => r.online).length}/{robots.length}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
        {groups.map((g) => {
          const list = robots.filter((r) => r.role === g.role)
          return (
            <div key={g.role}>
              <div className="text-[10px] uppercase tracking-wider text-text-dim px-1 mb-1.5">{g.label}</div>
              <div className="space-y-2">
                {list.map((r) => (
                  <RobotCard
                    key={r.id}
                    robot={r}
                    selected={selectedId === r.id}
                    onSelect={() => onSelect(r.id)}
                    onOpenDetail={() => onOpenDetail(r.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
