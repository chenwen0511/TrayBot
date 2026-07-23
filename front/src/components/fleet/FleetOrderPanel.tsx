import { ROLE_LABEL, type FleetWorkOrder } from '../../types/fleet'

interface Props {
  orders: FleetWorkOrder[]
  selectedRobotId: string | null
  onSelectRobot: (robotId: string) => void
}

const statusStyle: Record<string, string> = {
  in_progress: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  pending: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  completed: 'bg-surface-3 text-text-dim border-border',
}

const statusLabel: Record<string, string> = {
  in_progress: '执行中',
  pending: '排队中',
  completed: '已完成',
}

const statusHint: Record<string, string> = {
  in_progress: '机器人已接单并正在执行',
  pending: '已建单，等待空闲机器人接单',
  completed: '本工单目标盘数已全部完成',
}

const PRIORITY_HINT: Record<string, string> = {
  P1: '优先级 P1：最高，优先派机',
  P2: '优先级 P2：次高，正常调度',
  P3: '优先级 P3：可延后',
}

const PRIORITY_LABEL: Record<string, string> = {
  P1: '高优',
  P2: '次优',
  P3: '普通',
}

function Term({
  label,
  hint,
  className = '',
}: {
  label: string
  hint: string
  className?: string
}) {
  return (
    <span
      title={hint}
      className={`cursor-help border-b border-dotted border-text-dim/40 ${className}`}
    >
      {label}
    </span>
  )
}

export default function FleetOrderPanel({ orders, selectedRobotId, onSelectRobot }: Props) {
  const active = orders.filter((o) => o.status !== 'completed')
  const inbound = active.filter((o) => o.role === 'inbound')
  const outbound = active.filter((o) => o.role === 'outbound')

  const renderGroup = (
    opts: {
      title: string
      subtitle: string
      list: FleetWorkOrder[]
      accentDot: string
      accentBorder: string
      accentBg: string
    },
  ) => (
    <section
      className={`rounded-lg border ${opts.accentBorder} ${opts.accentBg} p-2`}
    >
      <div className="flex items-start gap-2 px-0.5 mb-2">
        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${opts.accentDot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text">{opts.title}</span>
            <span className="ml-auto text-[10px] font-mono text-text-dim tabular-nums">
              {opts.list.length}
            </span>
          </div>
          <p className="text-[10px] text-text-dim leading-snug mt-0.5">{opts.subtitle}</p>
        </div>
      </div>

      <div className="space-y-2">
        {opts.list.length === 0 && (
          <div className="text-[10px] text-text-dim px-1 py-3 text-center border border-dashed border-border rounded-md">
            暂无活跃工单
          </div>
        )}
        {opts.list.map((o) => {
          const pct = o.totalTrays > 0 ? Math.round((o.deliveredTrays / o.totalTrays) * 100) : 0
          const selected = o.assigneeRobotId != null && o.assigneeRobotId === selectedRobotId
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => o.assigneeRobotId && onSelectRobot(o.assigneeRobotId)}
              className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                selected
                  ? 'bg-surface-3 border-accent/40'
                  : 'bg-surface-2/80 border-border hover:border-accent/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <Term
                  label={o.id}
                  hint={
                    o.role === 'inbound'
                      ? '工单号 WO-IN：入库（拆包→库房）'
                      : '工单号 WO-OUT：出库（库房→产线）'
                  }
                  className="text-[10px] font-mono text-text-dim"
                />
                <span
                  title={statusHint[o.status]}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border cursor-help ${statusStyle[o.status]}`}
                >
                  {statusLabel[o.status]}
                </span>
              </div>

              <div className="text-xs font-medium text-text mb-1">{o.title}</div>
              <div
                className="text-[10px] text-text-dim mb-1.5 cursor-help"
                title="路径：取货点 → 送达点"
              >
                {o.pickup}
                <span className="mx-1 text-text-dim/60">→</span>
                {o.delivery}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-text-dim mb-1.5">
                <Term
                  label={ROLE_LABEL[o.role]}
                  hint={
                    o.role === 'inbound'
                      ? '业务角色：入库链路，拆包区物料搬运至电子库上架'
                      : '业务角色：出库链路，电子库取料运送至 SMT 产线供料'
                  }
                />
                {o.assigneeRobotId ? (
                  <Term
                    label={o.assigneeRobotId}
                    hint="执行机器人：点击本卡可选中该机"
                    className="font-mono text-accent"
                  />
                ) : (
                  <span className="text-text-dim/70">未派机</span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  {o.eta && (
                    <Term
                      label={`预计 ${o.eta}`}
                      hint="ETA（Estimated Time of Arrival）：预计剩余完成时间"
                      className="tabular-nums"
                    />
                  )}
                  <Term
                    label={`${o.priority} ${PRIORITY_LABEL[o.priority]}`}
                    hint={PRIORITY_HINT[o.priority]}
                    className="text-warn"
                  />
                </span>
              </div>

              <div
                className="h-1 rounded-full bg-surface overflow-hidden"
                title={`进度：已完成 ${o.deliveredTrays} / 目标 ${o.totalTrays} 盘（${pct}%）`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-teal"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] font-mono text-text-dim">
                <Term
                  label={`${o.deliveredTrays}/${o.totalTrays} 盘`}
                  hint="盘：料盘/卷盘件数；分子为已完成，分母为工单目标"
                />
                <span className="mx-1">·</span>
                {pct}%
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text">工单链路</h2>
          <p className="text-[10px] text-text-dim mt-0.5">按物流方向分组的搬运任务</p>
        </div>
        <Term
          label="双链路"
          hint="双链路：入库（拆包→电子库）与出库（电子库→产线）两条业务线并行调度"
          className="text-[10px] font-mono text-text-dim"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-3">
        {renderGroup({
          title: '拆包 → 电子库',
          subtitle: '入库链路 · 拆包区取料，运至电子库货架上架',
          list: inbound,
          accentDot: 'bg-teal-400',
          accentBorder: 'border-teal-500/25',
          accentBg: 'bg-teal-500/[0.04]',
        })}

        {/* 链路分隔 */}
        <div className="flex items-center gap-2 px-1" aria-hidden>
          <div className="h-px flex-1 bg-border" />
          <span className="text-[9px] tracking-widest text-text-dim/70 uppercase">出库链路</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {renderGroup({
          title: '电子库 → SMT 产线',
          subtitle: '出库链路 · 电子库取料，运至 SMT 产线供料口',
          list: outbound,
          accentDot: 'bg-violet-400',
          accentBorder: 'border-violet-500/25',
          accentBg: 'bg-violet-500/[0.04]',
        })}
      </div>
    </div>
  )
}
