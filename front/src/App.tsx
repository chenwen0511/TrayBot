import Header from './components/Header'
import RobotStatusPanel from './components/RobotStatusPanel'
import CameraGrid from './components/CameraGrid'
import FloorMap from './components/FloorMap'
import WorkOrderPool from './components/WorkOrderPool'
import LiveFeed from './components/LiveFeed'
import ResizableVerticalSplit from './components/ResizableVerticalSplit'
import { mockCameras } from './mock/data'
import { useDashboard } from './hooks/useDashboard'

export default function App() {
  const {
    robotStatus,
    mapPoints,
    liveEvents,
    workOrders,
    currentStepTitle,
    activeRoute,
    thinkingLiveId,
  } = useDashboard()

  const deltaStream = import.meta.env.VITE_USE_MOCK === 'false'

  return (
    <div className="flex flex-col h-full bg-surface">
      <Header robot={robotStatus} />

      <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
        {/* 左：本体状态 */}
        <div className="col-span-12 lg:col-span-2 border-r border-border bg-surface-2 overflow-hidden">
          <RobotStatusPanel robot={robotStatus} />
        </div>

        {/* 中：摄像头 + 地图 */}
        <div className="col-span-12 lg:col-span-7 flex flex-col border-r border-border bg-surface-2 min-h-0 overflow-hidden">
          <div className="shrink-0 border-b border-border">
            <CameraGrid cameras={mockCameras} />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <FloorMap points={mapPoints} currentStepTitle={currentStepTitle} activeRoute={activeRoute} />
          </div>
        </div>

        {/* 右：工单池 + 图文直播（可拖拽分割线） */}
        <div className="col-span-12 lg:col-span-3 flex flex-col bg-surface-2 min-h-0 overflow-hidden">
          <ResizableVerticalSplit
            top={<WorkOrderPool orders={workOrders} />}
            bottom={<LiveFeed events={liveEvents} deltaStream={deltaStream} thinkingLiveId={thinkingLiveId} />}
          />
        </div>
      </div>
    </div>
  )
}
