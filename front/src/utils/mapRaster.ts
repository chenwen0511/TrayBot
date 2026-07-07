import type { MapConfig, MapBlock3D, ResolvedRoute, VoxelCell, VoxelCell3D, VoxelType } from '../types/map'
import type { ActiveRoute } from '../types'
import { landmarkToPixel } from '../types/map'

/** 全局体素数量上限，防止 WebGL 卡死 */
export const MAX_VOXELS_3D = 8000

const DENSITY: Record<string, number> = {
  floor: 0.2,
  wall: 0.75,
  shelf: 0.7,
  cabinet: 0.72,
  desk: 0.65,
  machine: 0.75,
  door: 0.6,
}

/** 仅体素化外观结构；floor 由 3D 视图用平面渲染 */
const SKIP_VOXEL_TYPES = new Set(['floor'])

function hash3(gx: number, gy: number, gz: number): number {
  const s = Math.sin(gx * 12.9898 + gy * 78.233 + gz * 37.719) * 43758.5453
  return s - Math.floor(s)
}

function isSurface(gx: number, gy: number, gz: number, gx0: number, gy0: number, gz0: number, gx1: number, gy1: number, gz1: number): boolean {
  return gx === gx0 || gx === gx1 - 1 || gy === gy0 || gy === gy1 - 1 || gz === gz0 || gz === gz1 - 1
}

/** legacy 2D 栅格化 */
export function rasterizeMap(config: MapConfig): VoxelCell[] {
  const { regions, voxelSize, palette } = config
  const cells: VoxelCell[] = []
  const seen = new Set<string>()

  for (const region of regions) {
    const color = palette[region.type] ?? '#888'
    const density = DENSITY[region.type] ?? 0.8
    const x0 = Math.floor(region.x / voxelSize)
    const y0 = Math.floor(region.y / voxelSize)
    const x1 = Math.ceil((region.x + region.w) / voxelSize)
    const y1 = Math.ceil((region.y + region.h) / voxelSize)

    for (let gy = y0; gy < y1; gy += 1) {
      for (let gx = x0; gx < x1; gx += 1) {
        const px = gx * voxelSize
        const py = gy * voxelSize
        if (px + voxelSize < region.x || py + voxelSize < region.y) continue
        if (px > region.x + region.w || py > region.y + region.h) continue
        const key = `${gx},${gy}`
        if (seen.has(key)) continue
        if (hash3(gx, gy, 0) > density) continue
        seen.add(key)
        cells.push({ x: px, y: py, type: region.type as VoxelType, color })
      }
    }
  }
  return cells
}

/** 3D 体素：仅外表面 + 稀疏填充，跳过地面大块 */
export function rasterizeMap3D(config: MapConfig, maxVoxels = MAX_VOXELS_3D): VoxelCell3D[] {
  if (!config.blocks?.length) return []
  const vs = config.voxelSize
  const palette = config.palette
  const cells: VoxelCell3D[] = []
  const seen = new Set<string>()

  for (const block of config.blocks) {
    if (SKIP_VOXEL_TYPES.has(block.type)) continue
    const color = palette[block.type] ?? '#888'
    const density = DENSITY[block.type] ?? 0.75
    blockToVoxels(block, vs, color, density, seen, cells, maxVoxels)
    if (cells.length >= maxVoxels) break
  }
  return cells
}

function blockToVoxels(
  block: MapBlock3D,
  vs: number,
  color: string,
  density: number,
  seen: Set<string>,
  out: VoxelCell3D[],
  maxVoxels: number,
): void {
  const gx0 = Math.floor(block.x / vs)
  const gy0 = Math.floor(block.y / vs)
  const gz0 = Math.floor(block.z / vs)
  const gx1 = Math.ceil((block.x + block.w) / vs)
  const gy1 = Math.ceil((block.y + block.h) / vs)
  const gz1 = Math.ceil((block.z + block.d) / vs)

  for (let gz = gz0; gz < gz1; gz += 1) {
    for (let gy = gy0; gy < gy1; gy += 1) {
      for (let gx = gx0; gx < gx1; gx += 1) {
        if (out.length >= maxVoxels) return
        const key = `${gx},${gy},${gz}`
        if (seen.has(key)) continue
        if (!isSurface(gx, gy, gz, gx0, gy0, gz0, gx1, gy1, gz1) && hash3(gx, gy, gz) > density) {
          continue
        }
        seen.add(key)
        out.push({ x: gx * vs, y: gy * vs, z: gz * vs, color })
      }
    }
  }
}

export function resolveRoutes(config: MapConfig): ResolvedRoute[] {
  const byId = Object.fromEntries(config.landmarks.map((l) => [l.id, l]))
  return config.routes
    .map((route) => {
      const from = byId[route.from]
      const to = byId[route.to]
      if (!from || !to) return null
      const p1 = landmarkToPixel(from, config)
      const p2 = landmarkToPixel(to, config)
      return {
        id: route.id as ActiveRoute,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
      }
    })
    .filter((r): r is ResolvedRoute => r !== null)
}

export function resolveRoutes3D(config: MapConfig) {
  const scale = config.scale2d ?? 20
  const byId = Object.fromEntries(config.landmarks.map((l) => [l.id, l]))
  return config.routes
    .map((route) => {
      const from = byId[route.from]
      const to = byId[route.to]
      if (!from || !to) return null
      const fx = config.unit === 'm' || from.z !== undefined ? from.x : from.x / scale
      const fz = config.unit === 'm' || from.z !== undefined ? (from.z ?? 0) : (from.y ?? 0) / scale
      const tx = config.unit === 'm' || to.z !== undefined ? to.x : to.x / scale
      const tz = config.unit === 'm' || to.z !== undefined ? (to.z ?? 0) : (to.y ?? 0) / scale
      return {
        id: route.id as ActiveRoute,
        x1: fx,
        y1: 0.3,
        z1: fz,
        x2: tx,
        y2: 0.3,
        z2: tz,
      }
    })
    .filter(Boolean)
}

export function countVoxels3D(config: MapConfig): number {
  return rasterizeMap3D(config, Number.MAX_SAFE_INTEGER).length
}
