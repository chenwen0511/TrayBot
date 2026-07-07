import { useMemo } from 'react'
import type { MapConfig } from '../types/map'
import { rasterizeMap } from '../utils/mapRaster'

interface VoxelMapLayerProps {
  config: MapConfig
  visible?: boolean
  opacity?: number
}

export default function VoxelMapLayer({ config, visible = true, opacity = 0.95 }: VoxelMapLayerProps) {
  const voxels = useMemo(() => rasterizeMap(config), [config])
  const size = config.voxelSize - 0.5

  if (!visible) return null

  return (
    <g opacity={opacity}>
      {voxels.map((v, i) => (
        <rect
          key={`${v.x}-${v.y}-${i}`}
          x={v.x}
          y={v.y}
          width={size}
          height={size}
          fill={v.color}
          rx={0.5}
        />
      ))}
    </g>
  )
}
