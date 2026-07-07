import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ActiveRoute } from '../mock/useMockDashboard'
import type { MapPoint } from '../types'
import type { MapBlock3D, MapConfig } from '../types/map'
import { robotPixelToMeters } from '../types/map'
import { resolveRoutes3D } from '../utils/mapRaster'

interface VoxelMap3DProps {
  config: MapConfig
  points: MapPoint[]
  activeRoute?: ActiveRoute
  layers: { map: boolean; pointCloud: boolean; path: boolean; waypoints: boolean }
  follow?: boolean
}

/** 实体块渲染：每个 block 一个 Box，约 50 个网格，毫秒级加载 */
function addBlockMeshes(scene: THREE.Scene, blocks: MapBlock3D[], palette: Record<string, string>) {
  const groups: THREE.Mesh[] = []
  for (const b of blocks) {
    if (b.type === 'floor') continue
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d)
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[b.type] ?? '#888888'),
      roughness: 0.62,
      metalness: 0.06,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2)
    mesh.userData.blockType = b.type
    scene.add(mesh)
    groups.push(mesh)
  }
  return groups
}

export default function VoxelMap3D({
  config,
  points,
  activeRoute,
  layers,
  follow = true,
}: VoxelMap3DProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const pointsRef = useRef(points)
  const layersRef = useRef(layers)
  const activeRouteRef = useRef(activeRoute)
  pointsRef.current = points
  layersRef.current = layers
  activeRouteRef.current = activeRoute

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !config.blocks?.length) return

    const W = config.size?.width ?? 30
    const D = config.size?.depth ?? 15

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x050608)
    scene.fog = new THREE.Fog(0x050608, 40, 75)

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 200)
    camera.position.set(W * 0.55, 18, D * 1.35)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(W / 2, 0.8, D / 2)
    controls.maxPolarAngle = Math.PI / 2.05
    controls.minDistance = 8
    controls.maxDistance = 55

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(18, 24, 12)
    scene.add(dir)

    const floorPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.palette.floor ?? '#00e5c0'),
        roughness: 0.9,
        transparent: true,
        opacity: 0.28,
      }),
    )
    floorPlane.rotation.x = -Math.PI / 2
    floorPlane.position.set(W / 2, 0.01, D / 2)
    scene.add(floorPlane)

    const blockMeshes = addBlockMeshes(scene, config.blocks, config.palette)

    const routeLines: THREE.Line[] = []
    for (const route of resolveRoutes3D(config)) {
      if (!route) continue
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(route.x1, 0.25, route.z1),
        new THREE.Vector3(route.x2, 0.25, route.z2),
      ])
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.45 }),
      )
      line.userData.routeId = route.id
      scene.add(line)
      routeLines.push(line)
    }

    const landmarkMeshes: THREE.Group[] = []
    const scale = config.scale2d ?? 20
    for (const lm of config.landmarks) {
      const mx = config.unit === 'm' || lm.z !== undefined ? lm.x : lm.x / scale
      const mz = config.unit === 'm' || lm.z !== undefined ? (lm.z ?? 0) : (lm.y ?? 0) / scale
      const g = new THREE.Group()
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 1.8, 10),
        new THREE.MeshStandardMaterial({
          color: lm.type === 'home' ? 0x6366f1 : lm.type === 'pickup' ? 0xf59e0b : 0x10b981,
        }),
      )
      pillar.position.set(mx, 0.9, mz)
      g.add(pillar)
      scene.add(g)
      landmarkMeshes.push(g)
    }

    const robotGroup = new THREE.Group()
    robotGroup.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.45, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x00d4aa }),
      ),
    )
    robotGroup.children[0].position.y = 0.3
    scene.add(robotGroup)

    const updateRobot = () => {
      const robot = pointsRef.current.find((p) => p.type === 'robot')
      if (robot) {
        const { x, z } = robotPixelToMeters(robot.x, robot.y, config)
        robotGroup.position.set(x, 0, z)
      }
    }
    updateRobot()

    let frameId = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      controls.update()
      if (follow) updateRobot()

      const ly = layersRef.current
      const ar = activeRouteRef.current
      floorPlane.visible = ly.map
      blockMeshes.forEach((m) => { m.visible = ly.map })
      routeLines.forEach((l) => {
        l.visible = ly.path
        const active = l.userData.routeId === ar
        ;(l.material as THREE.LineBasicMaterial).color.set(active ? 0x00d4aa : 0x334155)
        ;(l.material as THREE.LineBasicMaterial).opacity = active ? 0.95 : 0.45
      })
      landmarkMeshes.forEach((g) => { g.visible = ly.waypoints })

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      blockMeshes.forEach((m) => {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      })
      floorPlane.geometry.dispose()
      ;(floorPlane.material as THREE.Material).dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [config.id, config.blocks?.length, follow])

  return <div ref={mountRef} className="absolute inset-0" />
}
