import Header from './components/Header'
import LeftSidebar from './components/LeftSidebar'
import MapVisualization from './components/MapVisualization'
import RightSidebar from './components/RightSidebar'
import { mockCameras } from './mock/data'
import { useDashboard } from './hooks/useDashboard'
import { useMapConfig } from './hooks/useMapConfig'

export default function App() {
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

  return (
    <div className="flex flex-col h-full bg-surface">
      <Header />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <LeftSidebar
          robot={robotStatus}
          cameras={mockCameras}
          workOrders={workOrders}
          liveEvents={liveEvents}
        />

        <MapVisualization
          mapConfig={mapConfig}
          points={mapPoints}
          currentStepTitle={currentStepTitle}
          activeRoute={activeRoute}
          speed={robotStatus.speed}
        />

        <RightSidebar
          workOrders={workOrders}
          liveEvents={liveEvents}
          robot={robotStatus}
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
