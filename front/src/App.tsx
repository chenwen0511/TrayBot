import { useCallback, useEffect, useState } from 'react'
import FleetOverview from './pages/FleetOverview'
import RobotDetailPage from './pages/RobotDetailPage'

type Route =
  | { name: 'fleet' }
  | { name: 'robot'; robotId: string }

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const path = raw.startsWith('/') ? raw : `/${raw}`
  const robotMatch = path.match(/^\/robot\/([^/]+)\/?$/)
  if (robotMatch) {
    return { name: 'robot', robotId: decodeURIComponent(robotMatch[1]) }
  }
  return { name: 'fleet' }
}

function setHash(route: Route) {
  if (route.name === 'fleet') {
    window.location.hash = '#/'
  } else {
    window.location.hash = `#/robot/${encodeURIComponent(route.robotId)}`
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseHash())

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    // 默认进入车间总览
    if (!window.location.hash) {
      window.location.hash = '#/'
    }
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const openRobot = useCallback((robotId: string) => {
    setHash({ name: 'robot', robotId })
  }, [])

  const backToFleet = useCallback(() => {
    setHash({ name: 'fleet' })
  }, [])

  if (route.name === 'robot') {
    return <RobotDetailPage robotId={route.robotId} onBackToFleet={backToFleet} />
  }

  return <FleetOverview onOpenRobot={openRobot} />
}
