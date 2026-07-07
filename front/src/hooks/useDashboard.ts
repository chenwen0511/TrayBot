import { useMockDashboard } from '../mock/useMockDashboard'
import { useDashboardSocket } from './useDashboardSocket'
import type { MapPoint } from '../types'
import { mockMapPoints } from '../mock/data'

const DEFAULT_LANDMARKS = mockMapPoints.filter((p) => p.type !== 'robot')

export function useDashboard(landmarks: MapPoint[] = DEFAULT_LANDMARKS) {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
  const mock = useMockDashboard(useMock, landmarks)
  const live = useDashboardSocket(!useMock, landmarks)
  return useMock ? mock : live
}
