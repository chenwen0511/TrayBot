import { useMockDashboard } from '../mock/useMockDashboard'
import { useDashboardSocket } from './useDashboardSocket'

export function useDashboard() {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
  const mock = useMockDashboard(useMock)
  const live = useDashboardSocket(!useMock)
  return useMock ? mock : live
}
