import { useEffect, useMemo, useState } from 'react'
import type { MapConfig } from '../types/map'
import { landmarksToMapPoints } from '../types/map'

const FETCH_TIMEOUT_MS = 4000

const FALLBACK_MAP: MapConfig = {
  id: 'factory_01',
  name: 'SMT电子料盘厂房',
  floor: '1F',
  unit: 'm',
  size: { width: 30, depth: 15, height: 2 },
  scale2d: 20,
  viewBox: { width: 600, height: 300 },
  voxelSize: 0.1,
  maxHeight: 2,
  renderMode: 'blocks',
  palette: {
    floor: '#00e5c0',
    wall: '#ff6ec7',
    shelf: '#ff4088',
    cabinet: '#e879f9',
    desk: '#00c9a7',
    machine: '#ff6ec7',
    door: '#334155',
  },
  blocks: [],
  regions: [],
  landmarks: [
    { id: 'home', type: 'home', label: 'HOME', x: 1.7, z: 10.4 },
    { id: 'pickup', type: 'pickup', label: '取料货架 A-03', x: 14.7, z: 3.6 },
    { id: 'delivery', type: 'delivery', label: '送料货架 B-07', x: 13.4, z: 9.9 },
  ],
  routes: [
    { id: 'home-pickup', from: 'home', to: 'pickup' },
    { id: 'pickup-delivery', from: 'pickup', to: 'delivery' },
    { id: 'delivery-home', from: 'delivery', to: 'home' },
    { id: 'delivery-pickup', from: 'delivery', to: 'pickup' },
  ],
}

export function useMapConfig(mapId = 'factory_01') {
  const [mapConfig, setMapConfig] = useState<MapConfig>(FALLBACK_MAP)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/map?map_id=${encodeURIComponent(mapId)}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as MapConfig
        if (!cancelled) setMapConfig(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'load failed')
          setMapConfig(FALLBACK_MAP)
        }
      } finally {
        window.clearTimeout(timer)
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [mapId])

  const landmarks = useMemo(
    () => landmarksToMapPoints(mapConfig),
    [mapConfig],
  )

  return {
    mapConfig,
    landmarks,
    loading,
    error,
  }
}
