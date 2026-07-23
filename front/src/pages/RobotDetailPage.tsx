import Header from '../components/Header'
import LeftSidebar from '../components/LeftSidebar'
import MapVisualization from '../components/MapVisualization'
import RightSidebar from '../components/RightSidebar'
import { mockCameras } from '../mock/data'
import { useDashboard } from '../hooks/useDashboard'
import { useMapConfig } from '../hooks/useMapConfig'

interface Props {
  robotId: string
  onBackToFleet: () => void
}

/** 单机作业详情（原监控中心主界面） */
export default function RobotDetailPage({ robotId, onBackToFleet }: Props) {
  const { mapConfig, landmarks, loading, error } = useMapConfig()

  const {
    robotStatus,
    mapPoints,
    liveEvents,
    workOrders,
    currentStepTitle,
    activeRoute,
    thinkingLiveId,
  } = useDashboard(landmarks)

  const deltaStream = import.meta.env.VITE_USE_MOCK === 'false'
  const robot = { ...robotStatus, name: robotId }

  return (
    <div className="flex flex-col h-full bg-surface">
      <Header
        title="SMT上下料系统监控中心"
        robotId={robotId}
        onBackToFleet={onBackToFleet}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <LeftSidebar
          robot={robot}
          cameras={mockCameras}
          workOrders={workOrders}
          liveEvents={liveEvents}
        />

        <MapVisualization
          mapConfig={mapConfig}
          points={mapPoints}
          currentStepTitle={currentStepTitle}
          activeRoute={activeRoute}
          speed={robot.speed}
        />

        <RightSidebar
          workOrders={workOrders}
          liveEvents={liveEvents}
          robot={robot}
          deltaStream={deltaStream}
          thinkingLiveId={thinkingLiveId}
        />
      </div>

      {loading && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-text-dim bg-surface-2/90 px-2 py-1 rounded">
          加载地图…
        </div>
      )}
      {!loading && error && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-warn bg-surface-2/90 px-2 py-1 rounded">
          地图使用本地缓存（{error}）
        </div>
      )}
    </div>
  )
}
