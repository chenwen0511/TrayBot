import { ROLE_LABEL, STATUS_LABEL, ZONE_LABEL, type FleetRobot } from '../../types/fleet'

interface Props {
  robots: FleetRobot[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenDetail: (id: string) => void
}

export default function WorkshopMap({ robots, selectedId, onSelect, onOpenDetail }: Props) {
  return (
    <div className="relative w-full h-full min-h-0 rounded-md overflow-hidden bg-viz-bg border border-border">
      {/* Zone layout: unpack / warehouse / smt */}
      <div className="absolute inset-0 flex flex-col p-3 gap-2">
        {/* Unpack */}
        <div className="relative flex-[0.9] rounded-lg border border-amber-500/25 bg-amber-500/[0.04] overflow-hidden">
          <div className="absolute top-2 left-3 text-[11px] font-semibold text-amber-300/90 tracking-wide">
            卷盘拆包区
          </div>
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex gap-3 justify-center opacity-40">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-10 h-8 rounded border border-amber-500/40 bg-amber-500/10" />
            ))}
            <div className="w-16 h-16 rounded border-2 border-yellow-400/50 bg-yellow-400/10 grid grid-cols-2 gap-0.5 p-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-sm bg-yellow-400/20" />
              ))}
            </div>
          </div>
        </div>

        {/* Warehouse */}
        <div className="relative flex-[1.6] rounded-lg border border-sky-500/25 bg-sky-500/[0.04] overflow-hidden">
          <div className="absolute top-2 left-3 text-[11px] font-semibold text-sky-300/90 tracking-wide z-10">
            SMT 电子库
          </div>
          <div className="absolute inset-6 top-8 bottom-4 flex gap-4 justify-center opacity-35">
            {[0, 1, 2].map((col) => (
              <div key={col} className="flex flex-col gap-1.5 flex-1 max-w-[120px]">
                {[0, 1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="flex-1 rounded-sm border border-sky-400/40 bg-gradient-to-b from-slate-500/30 to-slate-600/20"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* SMT line */}
        <div className="relative flex-[1.1] rounded-lg border border-violet-500/25 bg-violet-500/[0.04] overflow-hidden">
          <div className="absolute top-2 left-3 text-[11px] font-semibold text-violet-300/90 tracking-wide z-10">
            SMT 产线
          </div>
          <div className="absolute inset-x-6 top-8 bottom-3 flex flex-col gap-2 opacity-35">
            {[0, 1].map((row) => (
              <div key={row} className="flex-1 flex gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded border border-violet-400/40 bg-violet-500/10"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-2 max-w-[220px] justify-end pointer-events-none">
        <div className="px-2 py-1 rounded-md bg-surface-2/90 border border-border text-[10px] text-text-dim backdrop-blur-sm">
          点击机器人查看 · 双击进入详情
        </div>
      </div>

      {/* Robots */}
      {robots.map((r) => {
        const selected = selectedId === r.id
        return (
          <button
            key={r.id}
            type="button"
            title={`${r.name} · ${ROLE_LABEL[r.role]} · ${STATUS_LABEL[r.status]}`}
            onClick={() => onSelect(r.id)}
            onDoubleClick={() => onOpenDetail(r.id)}
            className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-transform ${
              selected ? 'scale-110 z-40' : 'hover:scale-105'
            }`}
            style={{ left: `${r.x}%`, top: `${r.y}%` }}
          >
            {selected && (
              <span
                className="absolute inset-[-10px] rounded-full border-2 opacity-40 animate-ping"
                style={{ borderColor: r.color }}
              />
            )}
            <span
              className="relative flex flex-col items-center justify-center w-10 h-10 rounded-xl text-white text-[9px] font-bold border-2 border-white/80 shadow-lg"
              style={{ background: r.color }}
            >
              <span className="opacity-90">TB</span>
              <span>{r.id.replace('TrayBot-', '')}</span>
            </span>
            {selected && (
              <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded-md bg-surface-2/95 border border-border text-[10px] text-text shadow-lg">
                {ZONE_LABEL[r.zone]} · {STATUS_LABEL[r.status]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
