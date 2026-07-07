import type { ActiveRoute, MapPoint, MapPointType } from './index'

export type VoxelType = 'floor' | 'wall' | 'shelf' | 'cabinet' | 'desk' | 'machine' | 'door'

export interface MapBlock3D {
  type: VoxelType
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  label?: string
}

export interface MapRegion {
  type: VoxelType
  x: number
  y: number
  w: number
  h: number
  label?: string
}

export interface MapLandmark {
  id: string
  type: MapPointType
  label: string
  /** 米（3D）或像素（legacy 2D） */
  x: number
  /** legacy 2D 像素 y */
  y?: number
  /** 米（3D 纵深） */
  z?: number
}

export interface MapRouteDef {
  id: string
  from: string
  to: string
}

export interface MapConfig {
  id: string
  name: string
  floor: string
  unit?: 'm' | 'px'
  size?: { width: number; depth: number; height: number }
  maxHeight?: number
  renderMode?: 'blocks' | 'voxels'
  scale2d?: number
  viewBox: { width: number; height: number }
  voxelSize: number
  palette: Record<string, string>
  blocks?: MapBlock3D[]
  regions: MapRegion[]
  landmarks: MapLandmark[]
  routes: MapRouteDef[]
  zones?: Array<{ id: string; label: string; x: number; z: number; w: number; d: number }>
}

export interface ResolvedRoute {
  id: ActiveRoute
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface VoxelCell {
  x: number
  y: number
  type: VoxelType
  color: string
}

export interface VoxelCell3D {
  x: number
  y: number
  z: number
  color: string
}

/** 地标 → 2D 地图像素坐标（供 SVG 叠加层与机器人动画） */
export function landmarkToPixel(lm: MapLandmark, config: MapConfig): { x: number; y: number } {
  const scale = config.scale2d ?? 20
  if (config.unit === 'm' || lm.z !== undefined) {
    return { x: lm.x * scale, y: (lm.z ?? 0) * scale }
  }
  return { x: lm.x, y: lm.y ?? 0 }
}

export function landmarksToMapPoints(config: MapConfig): MapPoint[] {
  return config.landmarks.map((lm) => {
    const { x, y } = landmarkToPixel(lm, config)
    return { id: lm.id, type: lm.type, label: lm.label, x, y }
  })
}

export function robotPixelToMeters(x: number, y: number, config: MapConfig) {
  const scale = config.scale2d ?? 20
  return { x: x / scale, z: y / scale }
}
