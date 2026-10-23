import * as THREE from 'three'
import type { Input } from '../engine/input'
import type { Renderer } from '../engine/renderer'
import { CITY_LOCATIONS, CityWorld, type CityLocation } from './city-world'
import type { CityState } from './city-state'
import { CONFIG } from './config'

export type CityMode = 'city' | 'interior'
export type CitySnapshot = {
  mode: CityMode
  x: number
  z: number
  selectedLocationId: string
  destinationId: string
  interiorLocationId: string
  arrived: boolean
  distanceToDestination: number | null
  route: { x: number; z: number }[]
  status: string
  visitedLocationIds: string[]
}

type CityHooks = { changed?: (snapshot: CitySnapshot) => void; status?: (message: string) => void }

const STREET_GRID = [-18, 0, 18]
const WORLD_LIMIT = 56

/** Urban exploration camera and movement state. No avatar, NPC, or character asset is created here. */
export class CityGame {
  readonly world: CityWorld
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 450)
  readonly target = new THREE.Vector3()
  readonly locations: readonly CityLocation[] = CITY_LOCATIONS
  private readonly locationById = new Map(CITY_LOCATIONS.map(location => [location.id, location]))
  private readonly routeGroup = new THREE.Group()
  private readonly selectionMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1.18, 32),
    new THREE.MeshBasicMaterial({ color: '#c4ead9', transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }),
  )
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly obstacleMargin = 1.1
  private readonly visited = new Set<string>()
  private mode: CityMode = 'city'
  private selectedLocationId: string
  private destinationId = ''
  private interiorLocationId = ''
  private yaw = 0.72
  private pitch = 0.76
  private cameraDistance = CONFIG.camera.distance
  private configuredCameraDistance = CONFIG.camera.distance
  private elapsed = 0
  private saveClock = 0
  private route: { x: number; z: number }[] = []
  private status = 'اختر وجهة من القائمة أو من الخريطة.'
  private dragging = false
  private dragMoved = false
  private lastPointer = { x: 0, y: 0 }
  private ignoreNextClick = false
  private previousTarget = new THREE.Vector2()
  private readonly pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    this.dragging = true
    this.dragMoved = false
    this.lastPointer = { x: event.clientX, y: event.clientY }
    this.previousTarget.set(event.clientX, event.clientY)
  }
  private readonly pointerMove = (event: PointerEvent) => {
    if (!this.dragging) return
    const dx = event.clientX - this.lastPointer.x
    const dy = event.clientY - this.lastPointer.y
    this.lastPointer = { x: event.clientX, y: event.clientY }
    if (Math.abs(event.clientX - this.previousTarget.x) + Math.abs(event.clientY - this.previousTarget.y) > 5) this.dragMoved = true
    this.yaw -= dx * 0.006
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0045, 0.43, 1.28)
  }
  private readonly pointerUp = () => {
    if (!this.dragging) return
    this.dragging = false
    if (this.dragMoved) {
      this.ignoreNextClick = true
      window.setTimeout(() => { this.ignoreNextClick = false }, 120)
    }
  }
  private readonly wheel = (event: WheelEvent) => {
    event.preventDefault()
    const min = this.mode === 'city' ? 28 : 11
    const max = this.mode === 'city' ? 68 : 25
    this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance + event.deltaY * 0.035, min, max)
  }

  constructor(
    private readonly renderer: Renderer,
    private readonly input: Input,
    initial: CityState,
    private readonly hooks: CityHooks = {},
  ) {
    this.world = new CityWorld(renderer.shadowMapSize)
    this.world.scene.add(this.routeGroup)
    this.selectionMarker.rotation.x = -Math.PI / 2
    this.selectionMarker.position.y = 0.2
    this.selectionMarker.visible = false
    this.selectionMarker.renderOrder = 14
    this.world.outdoor.add(this.selectionMarker)
    this.camera.fov = CONFIG.camera.fov
    this.camera.updateProjectionMatrix()
    this.target.set(THREE.MathUtils.clamp(initial.x, -WORLD_LIMIT, WORLD_LIMIT), 0, THREE.MathUtils.clamp(initial.z, -WORLD_LIMIT, WORLD_LIMIT))
    this.selectedLocationId = this.locationById.has(initial.selectedLocationId) ? initial.selectedLocationId : ''
    for (const id of initial.visitedLocationIds) if (this.locationById.has(id)) this.visited.add(id)
    if (this.selectedLocationId) this.setLocationHighlight(this.selectedLocationId)
    this.camera.position.set(30, 38, 34)
    this.camera.lookAt(this.target)
    renderer.gl.domElement.addEventListener('pointerdown', this.pointerDown)
    window.addEventListener('pointermove', this.pointerMove)
    window.addEventListener('pointerup', this.pointerUp)
    renderer.gl.domElement.addEventListener('wheel', this.wheel, { passive: false })
  }

  get snapshot(): CitySnapshot {
    const distance = this.destinationId ? this.distanceTo(this.destinationId) : null
    return {
      mode: this.mode,
      x: this.target.x,
      z: this.target.z,
      selectedLocationId: this.selectedLocationId,
      destinationId: this.destinationId,
      interiorLocationId: this.interiorLocationId,
      arrived: distance !== null && distance <= 5.5,
      distanceToDestination: distance,
      route: this.route.map(point => ({ ...point })),
      status: this.status,
      visitedLocationIds: [...this.visited],
    }
  }

  get suppressClick(): boolean {
    return this.ignoreNextClick
  }

  step(dt: number): void {
    this.elapsed += dt
    if (CONFIG.camera.distance !== this.configuredCameraDistance) {
      this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance + CONFIG.camera.distance - this.configuredCameraDistance, 28, 68)
      this.configuredCameraDistance = CONFIG.camera.distance
    }
    if (this.camera.fov !== CONFIG.camera.fov) {
      this.camera.fov = CONFIG.camera.fov
      this.camera.updateProjectionMatrix()
    }
    const speed = this.input.held('sprint') ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed
    const forwardX = -Math.sin(this.yaw)
    const forwardZ = -Math.cos(this.yaw)
    const rightX = -forwardZ
    const rightZ = forwardX
    const typing = document.activeElement?.matches('input,textarea') ?? false
    const moveX = typing ? 0 : this.input.move.x
    const moveY = typing ? 0 : this.input.move.y
    const dx = (rightX * moveX + forwardX * moveY) * speed * dt
    const dz = (rightZ * moveX + forwardZ * moveY) * speed * dt
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) {
      let x = THREE.MathUtils.clamp(this.target.x + dx, -WORLD_LIMIT, WORLD_LIMIT)
      let z = THREE.MathUtils.clamp(this.target.z + dz, -WORLD_LIMIT, WORLD_LIMIT)
      if (this.mode === 'city') {
        if (this.collides(x, this.target.z)) x = this.target.x
        if (this.collides(x, z)) z = this.target.z
      } else {
        x = THREE.MathUtils.clamp(x, -6.8, 6.8)
        z = THREE.MathUtils.clamp(z, -5.2, 5.2)
      }
      this.target.x = x
      this.target.z = z
      if (this.destinationId && this.distanceTo(this.destinationId) <= 5.5) {
        this.status = `وصلت إلى مدخل ${this.locationById.get(this.destinationId)?.name ?? 'الوجهة'}. يمكنك الدخول الآن.`
      }
      this.notify()
    }
    this.world.update(dt)
    this.saveClock += dt
    if (this.saveClock >= 1.5) {
      this.saveClock = 0
      this.hooks.changed?.(this.snapshot)
    }
  }

  render(_alpha: number, frameSeconds: number): void {
    const interior = this.mode === 'interior'
    const horizontal = Math.cos(this.pitch) * this.cameraDistance
    const vertical = Math.sin(this.pitch) * this.cameraDistance
    const focusY = interior ? 1.2 : 0
    const sway = interior ? 0 : Math.sin(this.elapsed * 0.025) * 0.18
    const desired = new THREE.Vector3(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + focusY + vertical,
      this.target.z + Math.cos(this.yaw) * horizontal + sway,
    )
    this.camera.position.lerp(desired, 1 - Math.exp(-CONFIG.camera.follow * Math.max(0, frameSeconds)))
    this.camera.lookAt(this.target.x, this.target.y + focusY, this.target.z)
    this.renderer.render(this.world.scene, this.camera)
  }

  selectLocation(id: string): boolean {
    const location = this.locationById.get(id)
    if (!location) return false
    this.selectedLocationId = id
    this.destinationId = ''
    this.route = []
    this.clearRoute()
    this.status = `${location.name} — ${location.description}`
    this.setLocationHighlight(id)
    this.notify()
    return true
  }

  setDestination(id: string): boolean {
    const location = this.locationById.get(id)
    if (!location) return false
    this.selectedLocationId = id
    this.destinationId = id
    this.setLocationHighlight(id)
    this.route = routeBetween({ x: this.target.x, z: this.target.z }, location.door ?? location.position)
    this.drawRoute(this.route)
    const distance = this.distanceTo(id)
    this.status = distance <= 5.5
      ? `وصلت إلى مدخل ${location.name}. يمكنك الدخول الآن.`
      : `المسار الأقصر إلى ${location.name} ظاهر على الشارع. تحرّك بـ WASD لاتباعه.`
    this.notify()
    return true
  }

  enterSelected(): boolean {
    const location = this.locationById.get(this.selectedLocationId)
    if (!location) return false
    if (this.mode === 'city' && this.distanceTo(location.id) > 5.5) {
      this.status = `اقترب من مدخل ${location.name} أولًا؛ اتبع المسار المحدد.`
      this.notify()
      return false
    }
    if (!this.world.setInterior(location.id)) return false
    this.mode = 'interior'
    this.interiorLocationId = location.id
    this.destinationId = ''
    this.route = []
    this.clearRoute()
    this.target.set(0, 0, 0)
    this.cameraDistance = 18
    this.pitch = 0.78
    this.status = `داخل ${location.name}. استكشف المكان ثم اختر «الخروج إلى المدينة».`
    this.visited.add(location.id)
    this.notify()
    return true
  }

  exitInterior(): void {
    if (this.mode !== 'interior') return
    const location = this.locationById.get(this.interiorLocationId)
    this.world.setInterior(null)
    this.mode = 'city'
    this.interiorLocationId = ''
    if (location) {
      const door = location.door ?? location.position
      const outwardX = door.x - location.position.x
      const outwardZ = door.z - location.position.z
      const length = Math.hypot(outwardX, outwardZ) || 1
      const exitClearance = 12 // Also clear parked-car colliders beside the shop fronts.
      this.target.set(door.x + outwardX / length * exitClearance, 0, door.z + outwardZ / length * exitClearance)
    }
    this.cameraDistance = 48
    this.status = 'عدت إلى شوارع المدينة.'
    this.notify()
  }

  returnToPlaza(): void {
    if (this.mode === 'interior') this.world.setInterior(null)
    this.mode = 'city'
    this.interiorLocationId = ''
    this.destinationId = ''
    this.route = []
    this.clearRoute()
    this.target.set(0, 0, 0)
    this.cameraDistance = 48
    this.status = 'موقعك الآن في الساحة المركزية.'
    this.notify()
  }

  pickLocation(clientX: number, clientY: number): string | null {
    const canvas = this.renderer.gl.domElement
    const rect = canvas.getBoundingClientRect()
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.world.pickLocation(this.raycaster)
  }

  dispose(): void {
    const canvas = this.renderer.gl.domElement
    canvas.removeEventListener('pointerdown', this.pointerDown)
    window.removeEventListener('pointermove', this.pointerMove)
    window.removeEventListener('pointerup', this.pointerUp)
    canvas.removeEventListener('wheel', this.wheel)
  }

  private distanceTo(id: string): number {
    const location = this.locationById.get(id)
    if (!location) return Infinity
    const door = location.door ?? location.position
    return Math.hypot(this.target.x - door.x, this.target.z - door.z)
  }

  private collides(x: number, z: number): boolean {
    return this.world.collisionRects.some(rect => x > rect.minX - this.obstacleMargin && x < rect.maxX + this.obstacleMargin && z > rect.minZ - this.obstacleMargin && z < rect.maxZ + this.obstacleMargin)
  }

  private drawRoute(points: { x: number; z: number }[]): void {
    this.clearRoute()
    if (points.length < 2) return
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(point.x, 0.32, point.z)))
    const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: '#8df0e4', dashSize: 2.3, gapSize: 0.9, linewidth: 2, transparent: true, opacity: 0.95 }))
    line.computeLineDistances()
    line.renderOrder = 12
    this.routeGroup.add(line)
  }

  private clearRoute(): void {
    this.routeGroup.clear()
  }

  private setLocationHighlight(id: string): void {
    const location = this.locationById.get(id)
    if (!location || this.mode !== 'city') { this.selectionMarker.visible = false; return }
    const door = location.door ?? location.position
    this.selectionMarker.position.set(door.x, 0.2, door.z)
    this.selectionMarker.visible = true
  }

  private notify(): void {
    this.hooks.status?.(this.status)
    this.hooks.changed?.(this.snapshot)
  }
}

function routeBetween(start: { x: number; z: number }, end: { x: number; z: number }): { x: number; z: number }[] {
  const nearest = (point: { x: number; z: number }) => ({
    x: STREET_GRID.reduce((best, value) => Math.abs(value - point.x) < Math.abs(best - point.x) ? value : best, STREET_GRID[0]),
    z: STREET_GRID.reduce((best, value) => Math.abs(value - point.z) < Math.abs(best - point.z) ? value : best, STREET_GRID[0]),
  })
  const a = nearest(start)
  const b = nearest(end)
  const points = [start, a]
  if (a.x !== b.x && a.z !== b.z) points.push({ x: b.x, z: a.z })
  points.push(b, end)
  return points.filter((point, index) => index === 0 || Math.hypot(point.x - points[index - 1].x, point.z - points[index - 1].z) > 0.25)
}
