import type { CameraStream, MapPoint, RobotStatus } from '../types'

export const mockRobotStatus: RobotStatus = {
  name: 'TrayBot-01',
  mode: 'operating',
  battery: 78,
  batteryVoltage: 48.2,
  cpuTemp: 52,
  speed: 0.35,
  uptime: '02:14:33',
  taskId: 'WO-20260629-001',
  networkLatency: 12,
  signalStrength: 92,
  joints: [
    { id: 'j1', name: '基座', temperature: 38, angle: 45.2 },
    { id: 'j2', name: '肩部', temperature: 42, angle: -12.5 },
    { id: 'j3', name: '肘部', temperature: 44, angle: 78.3 },
    { id: 'j4', name: '腕部1', temperature: 39, angle: -5.1 },
    { id: 'j5', name: '腕部2', temperature: 37, angle: 22.0 },
    { id: 'j6', name: '夹爪', temperature: 35, angle: 0.0 },
  ],
}

export const mockCameras: CameraStream[] = [
  {
    id: 'left',
    label: '左手腕',
    src: '/videos/camera-left.mp4',
    resolution: '640×480',
    fps: 30,
    online: true,
  },
  {
    id: 'front',
    label: '头部相机',
    src: '/videos/camera-front.mp4',
    resolution: '640×480',
    fps: 30,
    online: true,
  },
  {
    id: 'right',
    label: '右手腕',
    src: '/videos/camera-right.mp4',
    resolution: '640×480',
    fps: 30,
    online: true,
  },
]

export const mockMapPoints: MapPoint[] = [
  { id: 'home', type: 'home', label: 'HOME', x: 80, y: 320 },
  { id: 'pickup', type: 'pickup', label: '取料货架 A-03', x: 200, y: 80 },
  { id: 'delivery', type: 'delivery', label: '送料货架 B-07', x: 520, y: 80 },
  { id: 'robot', type: 'robot', label: 'TrayBot', x: 200, y: 80 },
]
