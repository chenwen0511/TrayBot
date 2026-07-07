import PanelCard from './PanelCard'
import TaskExecutionList from './TaskExecutionList'
import LiveFeed from './LiveFeed'
import NavigationControl from './NavigationControl'
import type { LiveEvent, RobotStatus, WorkOrder } from '../types'

interface RightSidebarProps {
  workOrders: WorkOrder[]
  liveEvents: LiveEvent[]
  robot: RobotStatus
  deltaStream?: boolean
  thinkingLiveId?: string | null
}

export default function RightSidebar({
  workOrders,
  liveEvents,
  robot,
  deltaStream = false,
  thinkingLiveId = null,
}: RightSidebarProps) {
  return (
    <aside className="w-[300px] shrink-0 flex flex-col gap-2 py-2 pl-0 pr-2 bg-surface min-h-0 overflow-hidden">
      <PanelCard title="任务执行列表">
        <TaskExecutionList orders={workOrders} robotName={robot.name} />
      </PanelCard>

      <section className="flex-1 min-h-0 flex flex-col bg-surface-2 rounded-md overflow-hidden">
        <div className="px-2.5 py-1.5 shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">实时图文直播</h2>
          <span className="flex items-center gap-1 text-[10px] text-text-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <LiveFeed
            events={liveEvents}
            deltaStream={deltaStream}
            thinkingLiveId={thinkingLiveId}
            variant="dark"
          />
        </div>
      </section>

      <PanelCard title="导航控制">
        <NavigationControl />
      </PanelCard>
    </aside>
  )
}
