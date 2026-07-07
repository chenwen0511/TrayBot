import type { MapPoint } from '../types'

interface MapStatusOverlayProps {
  robot?: MapPoint
  mapName?: string
  speed?: number
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function VelocityItem({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <span className="text-[11px] whitespace-nowrap">
      <span className="text-white/55">{label}</span>
      <span className="text-white font-mono ml-0.5">{value}</span>
      <span className="text-white/45 text-[10px] ml-0.5">{unit}</span>
    </span>
  )
}

/** 地图左上角横向状态条（参考工程 UI） */
export default function MapStatusOverlay({
  robot,
  mapName = 'Factory_01',
  speed = 0,
}: MapStatusOverlayProps) {
  const updatedAt = formatDateTime(new Date())

  // 由机器人速度估算三轴速度（演示用）
  const vx = robot ? ((robot.x / 600 - 0.5) * speed * 0.4).toFixed(2) : '0.00'
  const vy = robot ? ((robot.y / 380 - 0.5) * speed * 0.4).toFixed(2) : '0.00'
  const vyaw = '0.00'

  return (
    <div className="absolute top-3 left-3 z-10 pointer-events-none px-1 py-0.5 min-w-[420px]">
      {/* 第一行：地图 + 更新时间 */}
      <div className="flex items-center justify-between gap-6 text-[11px] mb-1.5 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">
        <span>
          <span className="text-white/55">地图: </span>
          <span className="text-white">{mapName}</span>
        </span>
        <span>
          <span className="text-white/55">更新时间: </span>
          <span className="text-white font-mono">{updatedAt}</span>
        </span>
      </div>

      {/* 第二行：速度 x / y / yaw */}
      <div className="flex items-center gap-5 text-[11px] [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">
        <VelocityItem label="速度 x:" value={vx} unit="m/s" />
        <VelocityItem label="速度 y:" value={vy} unit="m/s" />
        <VelocityItem label="速度 yaw:" value={vyaw} unit="rad/s" />
      </div>
    </div>
  )
}
