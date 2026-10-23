import * as THREE from 'three'

/** Stable world-space destination data. Positions identify each building; doors identify its entry. */
export type CityLocation = {
  id: string
  name: string
  category: 'home' | 'cafe' | 'furniture' | 'clothing' | 'appliances' | 'grocery'
  description: string
  position: { x: number; z: number }
  door: { x: number; z: number }
}

export const CITY_LOCATIONS: readonly CityLocation[] = [
  { id: 'home', name: 'المنزل', category: 'home', description: 'شقة صغيرة مفروشة تطل على واجهة سكنية هادئة.', position: { x: -30, z: -30 }, door: { x: -30, z: -23.9 } },
  { id: 'cafe', name: 'مقهى الساحة', category: 'cafe', description: 'مقهى محلي يضم منضدة تقديم وطاولات صغيرة وجلسات دافئة.', position: { x: 0, z: -30 }, door: { x: 0, z: -23.9 } },
  { id: 'furniture', name: 'بيت الأثاث', category: 'furniture', description: 'معرض أثاث يعرض غرفة معيشة وقطعًا منزلية على رفوف مختلفة.', position: { x: 30, z: -30 }, door: { x: 30, z: -23.9 } },
  { id: 'clothing', name: 'دار الأزياء', category: 'clothing', description: 'متجر ملابس يضم علاقات عرض وأرففًا وستارة لتجربة الملابس.', position: { x: -30, z: 30 }, door: { x: -30, z: 23.9 } },
  { id: 'appliances', name: 'البيت العصري', category: 'appliances', description: 'صالة عرض للأجهزة المنزلية مع منصات عرض وتجهيزات متنوعة.', position: { x: 0, z: 30 }, door: { x: 0, z: 23.9 } },
  { id: 'grocery', name: 'سوق الحي', category: 'grocery', description: 'بقالة صغيرة تضم ممرات ورفوفًا ومنضدة للدفع.', position: { x: 30, z: 30 }, door: { x: 30, z: 23.9 } },
]

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }
type Front = 1 | -1

const C = {
  asphalt: '#303438', asphaltPatch: '#383c3f', sidewalk: '#aaa69f', paving: '#c3bdb2',
  stoneDark: '#77736d', curb: '#d0cbc0', facade: ['#b6afa3', '#c2bbae', '#aaa99f', '#b9a99b', '#a8afb0', '#c3b6a7'],
  trim: '#ded8cd', glass: '#567078', glassLit: '#9a9c8c', metal: '#343a3b', roof: '#5b5b57',
  wood: '#765b43', leaf: '#526950', leafLight: '#68785d', soil: '#51483e', brass: '#9a8058',
}

const MAT: Record<string, THREE.MeshStandardMaterial> = {}
function material(key: string, color: string, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial {
  const existing = MAT[key]
  if (existing) return existing
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  MAT[key] = mat
  return mat
}

const asphaltMat = material('asphalt', C.asphalt, 0.98)
const sidewalkMat = material('sidewalk', C.sidewalk, 0.94)
const pavingMat = material('paving', C.paving, 0.92)
const curbMat = material('curb', C.curb, 0.88)
const trimMat = material('trim', C.trim, 0.72)
const glassMat = material('glass', C.glass, 0.24, 0.24)
const glassLightMat = material('glass-lit', C.glassLit, 0.3, 0.1)
const metalMat = material('metal', C.metal, 0.48, 0.52)
const woodMat = material('wood', C.wood, 0.86)
const leafMat = material('leaf', C.leaf, 0.92)
const leafLightMat = material('leaf-light', C.leafLight, 0.92)
const brassMat = material('brass', C.brass, 0.52, 0.35)

function box(parent: THREE.Object3D, name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material, cast = false, receive = false): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat)
  mesh.name = name
  mesh.position.set(x, y, z)
  mesh.castShadow = cast
  mesh.receiveShadow = receive
  parent.add(mesh)
  return mesh
}

function addRect(target: Rect[], x: number, z: number, width: number, depth: number, pad = 0): void {
  target.push({ minX: x - width / 2 - pad, maxX: x + width / 2 + pad, minZ: z - depth / 2 - pad, maxZ: z + depth / 2 + pad })
}

/** Canvas signage keeps the asset set self-contained and allows Arabic right-to-left labels. */
function makeSignTexture(label: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#303537'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#b5a27f'
  ctx.fillRect(0, 0, canvas.width, 7)
  ctx.fillRect(0, canvas.height - 7, canvas.width, 7)
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 37px Arial, sans-serif'
  ctx.fillStyle = '#eee9dc'
  ctx.fillText(label, canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function signMaterial(label: string): THREE.MeshStandardMaterial {
  const texture = makeSignTexture(label)
  return new THREE.MeshStandardMaterial({
    color: texture ? '#ffffff' : '#454746', map: texture, roughness: 0.74, metalness: 0.08,
    emissive: '#111211', emissiveIntensity: 0.12,
  })
}

/** Small, deterministic city block assembled from reusable primitive meshes only. */
export class CityWorld {
  readonly scene = new THREE.Scene()
  readonly outdoor = new THREE.Group()
  readonly interior = new THREE.Group()
  readonly collisionRects: Rect[] = []
  readonly locationObjects = new Map<string, THREE.Object3D>()
  readonly sun: THREE.DirectionalLight

  private readonly outdoorRects: Rect[] = []
  private readonly indoorRects: Rect[] = []
  private readonly interiorRooms = new Map<string, THREE.Group>()
  private readonly outsideBackground = new THREE.Color('#b7b6ae')
  private readonly outsideFog = new THREE.Fog('#b7b6ae', 74, 145)

  constructor(shadowMapSize = 1024) {
    this.scene.background = this.outsideBackground
    this.scene.fog = this.outsideFog
    this.scene.add(this.outdoor, this.interior)
    this.interior.visible = false

    this.scene.add(new THREE.HemisphereLight('#dce3e3', '#6e6559', 1.55))
    this.sun = new THREE.DirectionalLight('#fff0d8', 2.25)
    this.sun.position.set(-34, 58, 26)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    this.sun.shadow.camera.left = -58
    this.sun.shadow.camera.right = 58
    this.sun.shadow.camera.top = 58
    this.sun.shadow.camera.bottom = -58
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 135
    this.sun.shadow.bias = -0.0003
    this.sun.shadow.normalBias = 0.035
    this.scene.add(this.sun, this.sun.target)

    this.buildGroundAndStreets()
    this.buildCentralPlaza()
    this.buildBuildings()
    this.buildStreetFurniture()
    this.buildParkedCars()
    this.buildInteriors()
    this.collisionRects.push(...this.outdoorRects)
  }

  /** Switches between the outdoor city and the selected furnished, unpopulated room. */
  setInterior(locationId: string | null): boolean {
    if (locationId === null) {
      this.outdoor.visible = true
      this.interior.visible = false
      this.scene.background = this.outsideBackground
      this.scene.fog = this.outsideFog
      this.collisionRects.splice(0, this.collisionRects.length, ...this.outdoorRects)
      return true
    }
    const room = this.interiorRooms.get(locationId)
    if (!room) return false
    this.outdoor.visible = false
    this.interior.visible = true
    for (const [id, candidate] of this.interiorRooms) candidate.visible = id === locationId
    this.scene.background = new THREE.Color('#b9b7af')
    this.scene.fog = new THREE.Fog('#b9b7af', 32, 68)
    this.collisionRects.splice(0, this.collisionRects.length, ...this.indoorRects)
    return true
  }

  /** Advance lightweight ambient details; geometry is otherwise static. */
  update(dt: number): void {
    // Kept for the host game's uniform update loop; no expensive per-frame scene work is needed.
    void dt
  }

  /** Return a location id when a ray intersects one of the destination buildings. */
  pickLocation(raycaster: THREE.Raycaster): string | null {
    const hits = raycaster.intersectObjects([...this.locationObjects.values()], true)
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object
      while (object) {
        const id = object.userData.cityLocationId as unknown
        if (typeof id === 'string' && this.locationObjects.has(id)) return id
        object = object.parent
      }
    }
    return null
  }

  private buildGroundAndStreets(): void {
    box(this.outdoor, 'city ground', 0, -0.36, 0, 104, 0.5, 104, material('ground', '#827f77', 1), false, true)

    // Two broad east-west roads and two north-south roads form the walkable city grid.
    for (const z of [-18, 18]) {
      box(this.outdoor, 'asphalt boulevard', 0, -0.08, z, 96, 0.16, 9, asphaltMat, false, true)
      this.addLaneMarkingsHorizontal(z)
      this.addCrossingHorizontal(z)
      this.addSidewalkStrips(z, true)
    }
    for (const x of [-18, 18]) {
      box(this.outdoor, 'asphalt avenue', x, -0.075, 0, 9, 0.15, 96, asphaltMat, false, true)
      this.addLaneMarkingsVertical(x)
      this.addCrossingVertical(x)
      this.addSidewalkStrips(x, false)
    }

    // Subtle paved footpaths bind shop fronts to the street without turning the whole city into one slab.
    for (const z of [-24, 24]) box(this.outdoor, 'shopfront pavement', 0, -0.07, z, 94, 0.14, 2.3, sidewalkMat, false, true)
    for (const x of [-24, 24]) box(this.outdoor, 'side pavement', x, -0.07, 0, 2.3, 0.14, 94, sidewalkMat, false, true)
    for (const x of [-30, 0, 30]) {
      for (const z of [-30, 30]) {
        box(this.outdoor, 'front entry apron', x, -0.045, z < 0 ? -23.3 : 23.3, 5.2, 0.09, 1.1, pavingMat)
      }
    }

    // Painted lane dashes and discreet worn patches provide scale and asphalt variation.
    const dashMat = material('lane paint', '#c6c2b8', 0.95)
    for (const z of [-18, 18]) {
      for (let x = -44; x <= 44; x += 8) {
        if (Math.abs(x) > 22) box(this.outdoor, 'lane dash', x, 0.012, z, 3.1, 0.024, 0.12, dashMat)
      }
    }
    for (const x of [-18, 18]) {
      for (let z = -44; z <= 44; z += 8) {
        if (Math.abs(z) > 22) box(this.outdoor, 'lane dash', x, 0.014, z, 0.12, 0.024, 3.1, dashMat)
      }
    }
    const patchMat = material('asphalt patch', C.asphaltPatch, 1)
    for (let i = 0; i < 14; i += 1) {
      const x = -42 + ((i * 31) % 83)
      const z = -15 + ((i * 17) % 30)
      box(this.outdoor, 'road wear', x, 0.003, z, 0.48 + (i % 3) * 0.2, 0.008, 0.28, patchMat)
    }
  }

  private addLaneMarkingsHorizontal(z: number): void {
    const paint = material('crosswalk paint', '#dedbd2', 0.94)
    for (const x of [-18, 18]) {
      for (let i = -3; i <= 3; i += 1) box(this.outdoor, 'zebra crossing', x + i * 0.82, 0.014, z + (z > 0 ? -3.2 : 3.2), 0.48, 0.025, 1.65, paint)
    }
  }

  private addLaneMarkingsVertical(x: number): void {
    const paint = material('crosswalk paint', '#dedbd2', 0.94)
    for (const z of [-18, 18]) {
      for (let i = -3; i <= 3; i += 1) box(this.outdoor, 'zebra crossing', x + (x > 0 ? -3.2 : 3.2), 0.014, z + i * 0.82, 1.65, 0.025, 0.48, paint)
    }
  }

  private addCrossingHorizontal(z: number): void {
    const curb = material('curb stone', '#d1ccc2', 0.88)
    for (const x of [-18, 18]) {
      box(this.outdoor, 'curb edge', x, 0.025, z - 5.1, 15, 0.13, 0.24, curb)
      box(this.outdoor, 'curb edge', x, 0.025, z + 5.1, 15, 0.13, 0.24, curb)
    }
  }

  private addCrossingVertical(x: number): void {
    const curb = material('curb stone', '#d1ccc2', 0.88)
    for (const z of [-18, 18]) {
      box(this.outdoor, 'curb edge', x - 5.1, 0.025, z, 0.24, 0.13, 15, curb)
      box(this.outdoor, 'curb edge', x + 5.1, 0.025, z, 0.24, 0.13, 15, curb)
    }
  }

  private addSidewalkStrips(position: number, horizontal: boolean): void {
    const dims = horizontal ? [96, 2.4, 1.2] : [1.2, 2.4, 96]
    for (const side of [-1, 1]) {
      const x = horizontal ? 0 : position + side * 5.7
      const z = horizontal ? position + side * 5.7 : 0
      box(this.outdoor, 'raised sidewalk', x, -0.03, z, dims[0], dims[1], dims[2], sidewalkMat, false, true)
      const curbX = horizontal ? 0 : position + side * 4.95
      const curbZ = horizontal ? position + side * 4.95 : 0
      box(this.outdoor, 'sidewalk curb', curbX, 0.035, curbZ, horizontal ? 96 : 0.2, 0.18, horizontal ? 0.2 : 96, curbMat)
    }
  }

  private buildCentralPlaza(): void {
    const pavingDark = material('plaza inset', '#8e8a80', 0.92)
    box(this.outdoor, 'central plaza', 0, -0.035, 0, 17, 0.12, 17, pavingMat, false, true)
    box(this.outdoor, 'plaza center inset', 0, 0.03, 0, 9.3, 0.04, 9.3, pavingDark)
    for (let i = -7; i <= 7; i += 2) {
      box(this.outdoor, 'plaza paving joint', i, 0.034, 0, 0.025, 0.007, 16, stoneJointMat())
      box(this.outdoor, 'plaza paving joint', 0, 0.034, i, 16, 0.007, 0.025, stoneJointMat())
    }
    const basinMat = material('fountain stone', '#777a78', 0.65)
    const waterMat = new THREE.MeshStandardMaterial({ color: '#5d7778', roughness: 0.22, metalness: 0.12 })
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.32, 0.55, 20), basinMat)
    basin.position.set(0, 0.3, 0)
    basin.castShadow = true
    basin.receiveShadow = true
    this.outdoor.add(basin)
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.92, 1.92, 0.045, 24), waterMat)
    water.position.set(0, 0.6, 0)
    this.outdoor.add(water)
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.08, 10), brassMat)
    jet.position.set(0, 1.03, 0)
    this.outdoor.add(jet)
    const planterMat = material('planter', '#77756f', 0.86)
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]] as const) {
      box(this.outdoor, 'plaza planter', x, 0.3, z, 2.2, 0.55, 2.2, planterMat, false, true)
      this.addTree(x, 0.58, z, 0.88, false)
    }
    for (const [x, z, rot] of [[-4.1, 0, 0], [4.1, 0, 0], [0, -4.1, Math.PI / 2], [0, 4.1, Math.PI / 2]] as const) this.addBench(this.outdoor, x, z, rot)
  }

  private buildBuildings(): void {
    for (let i = 0; i < CITY_LOCATIONS.length; i += 1) {
      const location = CITY_LOCATIONS[i]
      const front: Front = location.position.z < 0 ? 1 : -1
      const building = new THREE.Group()
      building.name = `destination-${location.id}`
      building.position.set(location.position.x, 0, location.position.z)
      building.userData.cityLocationId = location.id
      this.outdoor.add(building)
      this.locationObjects.set(location.id, building)

      const width = 13.8
      const depth = 12.2
      const height = location.category === 'home' ? 12.2 : 10.7 + (i % 2) * 0.6
      const facade = material(`facade-${i}`, C.facade[i], 0.9)
      box(building, 'masonry building body', 0, height / 2, 0, width, height, depth, facade, true, true)
      box(building, 'foundation course', 0, 0.43, front * (depth / 2 + 0.035), width + 0.12, 0.42, 0.12, material('foundation', '#77746d', 0.91))
      box(building, 'roof parapet', 0, height + 0.3, 0, width + 0.42, 0.5, depth + 0.42, material('roof', C.roof, 0.88), true)
      box(building, 'roof surface', 0, height + 0.56, 0, width, 0.08, depth, material('roof top', '#77736c', 0.93))

      this.makeFacadeWindows(building, width, height, depth, front, location.category)
      this.makeEntry(building, depth, front, location.category)
      this.makeStoreSign(building, depth, height, front, location.name)
      this.makeFacadeDetails(building, width, depth, height, front, i)
      addRect(this.outdoorRects, location.position.x, location.position.z, width, depth, 0.18)
    }
  }

  private makeFacadeWindows(building: THREE.Group, width: number, height: number, depth: number, front: Front, category: CityLocation['category']): void {
    const frontZ = front * (depth / 2 + 0.045)
    const upperFloors = category === 'home' ? 3 : 2
    const topY = height - 2.2
    for (let row = 0; row < upperFloors; row += 1) {
      const y = 4.05 + row * 2.25
      if (y > topY) break
      for (let col = -2; col <= 2; col += 1) {
        if (category !== 'home' && row === 0 && col === 0) continue
        const x = col * 2.35
        this.makeWindow(building, x, y, frontZ, front, 1.38, 1.58, (row + col + 6) % 4 === 0)
        box(building, 'window sill', x, y - 0.85, frontZ + front * 0.11, 1.62, 0.12, 0.21, trimMat)
        box(building, 'window head trim', x, y + 0.84, frontZ + front * 0.08, 1.56, 0.09, 0.15, trimMat)
      }
    }
    // Ground-floor shop windows flank the recessed door.
    for (const x of [-4.7, -2.35, 2.35, 4.7]) {
      this.makeWindow(building, x, 1.85, frontZ, front, 1.92, 2.38, (Math.round(x) + 7) % 3 === 0)
      box(building, 'shop-window sill', x, 0.55, frontZ + front * 0.12, 2.08, 0.13, 0.23, trimMat)
    }
    box(building, 'front lintel', 0, 3.08, frontZ + front * 0.04, width - 0.7, 0.15, 0.17, trimMat)
  }

  private makeWindow(parent: THREE.Group, x: number, y: number, z: number, front: Front, width: number, height: number, lit: boolean): void {
    const glass = lit ? glassLightMat : glassMat
    const frameDepth = 0.17
    box(parent, 'window glass', x, y, z, width - 0.16, height - 0.16, 0.075, glass)
    box(parent, 'window jamb left', x - width / 2, y, z + front * 0.04, 0.12, height, frameDepth, trimMat)
    box(parent, 'window jamb right', x + width / 2, y, z + front * 0.04, 0.12, height, frameDepth, trimMat)
    box(parent, 'window frame top', x, y + height / 2, z + front * 0.04, width + 0.12, 0.12, frameDepth, trimMat)
    box(parent, 'window frame bottom', x, y - height / 2, z + front * 0.04, width + 0.12, 0.12, frameDepth, trimMat)
    box(parent, 'window mullion', x, y, z + front * 0.085, 0.065, height - 0.12, 0.09, material('mullion', '#535958', 0.52, 0.2))
    box(parent, 'window crossbar', x, y, z + front * 0.085, width - 0.12, 0.065, 0.09, material('mullion', '#535958', 0.52, 0.2))
  }

  private makeEntry(parent: THREE.Group, depth: number, front: Front, category: CityLocation['category']): void {
    const z = front * (depth / 2 + 0.1)
    const doorFrame = material('door frame', '#4a4c49', 0.63)
    const doorColor = material('door', category === 'home' ? '#6b6255' : '#4e5a5b', 0.58)
    box(parent, 'entry surround', 0, 1.65, z, 1.75, 3.25, 0.18, trimMat)
    box(parent, 'shop door', 0, 1.55, z + front * 0.105, 1.34, 2.9, 0.13, doorColor, true)
    box(parent, 'door glass', 0, 2.14, z + front * 0.18, 0.93, 1.48, 0.035, glassMat)
    box(parent, 'door kick plate', 0, 0.69, z + front * 0.19, 1.0, 0.17, 0.035, doorFrame)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), brassMat)
    knob.position.set(0.48, 1.48, z + front * 0.24)
    parent.add(knob)
    box(parent, 'door canopy', 0, 3.31, z + front * 0.27, 2.25, 0.16, 0.76, material('awning', '#68655e', 0.68), true)
  }

  private makeStoreSign(parent: THREE.Group, depth: number, height: number, front: Front, label: string): void {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.45), signMaterial(label))
    sign.name = 'Arabic and English shop sign'
    sign.position.set(0, Math.min(height - 1.5, 3.9), front * (depth / 2 + 0.15))
    if (front < 0) sign.rotation.y = Math.PI
    parent.add(sign)
    box(parent, 'sign cap', 0, sign.position.y + 0.77, front * (depth / 2 + 0.17), 7.55, 0.09, 0.18, brassMat)
    box(parent, 'sign base', 0, sign.position.y - 0.77, front * (depth / 2 + 0.17), 7.55, 0.09, 0.18, brassMat)
  }

  private makeFacadeDetails(parent: THREE.Group, width: number, depth: number, height: number, front: Front, seed: number): void {
    const z = front * (depth / 2 + 0.16)
    // A shallow cornice, pilasters and a modest rooftop service cabinet make the shell less box-like.
    box(parent, 'facade cornice', 0, height - 1.12, z, width + 0.4, 0.19, 0.38, trimMat)
    for (const x of [-6.45, 6.45]) box(parent, 'facade pilaster', x, height / 2, z, 0.24, height - 0.65, 0.28, material('pilaster', '#aaa69d', 0.88))
    const vent = material('service vent', '#62645f', 0.8, 0.12)
    box(parent, 'roof service housing', seed % 2 ? -3.7 : 3.6, height + 0.95, -1.2, 2.5, 0.72, 1.7, vent, true)
    for (let i = 0; i < 3; i += 1) box(parent, 'vent grille', -0.7 + i * 0.6, height + 0.98, front * (depth / 2 + 0.18), 0.08, 0.55, 0.08, metalMat)
  }

  private buildStreetFurniture(): void {
    // Lamps on the sidewalk grid; no real-time point lights are used, keeping mobile rendering modest.
    for (const z of [-24, 24]) {
      for (const x of [-43, -16, 16, 43]) this.addLamp(x, z)
    }
    for (const x of [-24, 24]) {
      for (const z of [-43, -16, 16, 43]) this.addLamp(x, z)
    }
    for (const [x, z, scale] of [
      [-43, -7, 0.9], [-43, 7, 0.92], [43, -7, 0.95], [43, 7, 0.9],
      [-7, -43, 0.95], [7, -43, 0.88], [-7, 43, 0.92], [7, 43, 0.9],
    ] as const) this.addTree(x, 0, z, scale, true)
    for (const [x, z, rotation] of [[-11, -24, 0], [11, -24, 0], [-11, 24, Math.PI], [11, 24, Math.PI]] as const) this.addBench(this.outdoor, x, z, rotation)
    this.addPlantersAndBins()
  }

  private addLamp(x: number, z: number): void {
    const lamp = new THREE.Group()
    lamp.position.set(x, 0, z)
    this.outdoor.add(lamp)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.12, 5.3, 8), metalMat)
    post.position.y = 2.65
    post.castShadow = true
    lamp.add(post)
    const arm = box(lamp, 'lamp arm', 0.35, 5.12, 0, 0.82, 0.09, 0.09, metalMat, true)
    arm.rotation.z = -0.15
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.28, 10), material('lamp shade', '#4b4e4c', 0.5, 0.45))
    head.position.set(0.69, 4.99, 0)
    lamp.add(head)
    const diffuser = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.045, 10), material('lamp diffuser', '#c4bca9', 0.48, 0.08))
    diffuser.position.set(0.69, 4.82, 0)
    lamp.add(diffuser)
  }

  private addTree(x: number, y: number, z: number, scale: number, addCollider: boolean): void {
    const tree = new THREE.Group()
    tree.position.set(x, y, z)
    tree.scale.setScalar(scale)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.5, 9), material('tree bark', '#655342', 0.96))
    trunk.position.y = 1.25
    trunk.castShadow = true
    tree.add(trunk)
    for (const [px, py, pz, size, mat] of [
      [-0.42, 2.72, 0, 1.28, leafMat], [0.42, 3.25, 0.1, 1.2, leafLightMat], [0, 3.87, -0.12, 1.08, leafMat],
    ] as const) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), mat)
      crown.position.set(px, py, pz)
      crown.scale.set(1, 0.92, 0.92)
      crown.castShadow = true
      tree.add(crown)
    }
    this.outdoor.add(tree)
    if (addCollider) addRect(this.outdoorRects, x, z, 0.85 * scale, 0.85 * scale, 0.08)
  }

  private addBench(parent: THREE.Object3D, x: number, z: number, rotation: number): void {
    const bench = new THREE.Group()
    bench.position.set(x, 0, z)
    bench.rotation.y = rotation
    parent.add(bench)
    box(bench, 'bench seat', 0, 0.53, 0, 1.8, 0.14, 0.55, woodMat, true)
    box(bench, 'bench back', 0, 0.98, -0.22, 1.8, 0.62, 0.13, woodMat, true)
    for (const lx of [-0.68, 0.68]) {
      box(bench, 'bench leg', lx, 0.26, -0.12, 0.11, 0.52, 0.11, metalMat, true)
      box(bench, 'bench back support', lx, 0.7, -0.19, 0.09, 0.78, 0.1, metalMat, true)
    }
  }

  private addPlantersAndBins(): void {
    const concrete = material('street planter', '#817e76', 0.9)
    const bin = material('bin', '#4d5554', 0.75, 0.16)
    for (const [x, z] of [[-13.2, -24], [13.2, -24], [-13.2, 24], [13.2, 24]] as const) {
      box(this.outdoor, 'street planter box', x, 0.4, z, 1.3, 0.78, 1.3, concrete, false, true)
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 9, 7), leafMat)
      shrub.position.set(x, 1, z)
      shrub.scale.set(1.1, 0.8, 1.1)
      shrub.castShadow = true
      this.outdoor.add(shrub)
      addRect(this.outdoorRects, x, z, 1.25, 1.25, 0.08)
    }
    for (const [x, z] of [[-8.2, -24], [8.2, -24], [-8.2, 24], [8.2, 24]] as const) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.86, 10), bin)
      mesh.position.set(x, 0.43, z)
      mesh.castShadow = true
      this.outdoor.add(mesh)
    }
  }

  private buildParkedCars(): void {
    const cars = [
      { x: -32, z: -18, color: '#777c7b', rot: 0 }, { x: 33, z: -18, color: '#7c6c5f', rot: Math.PI },
      { x: -33, z: 18, color: '#626b70', rot: Math.PI }, { x: 33, z: 18, color: '#8b8170', rot: 0 },
      { x: -18, z: -35, color: '#7b7770', rot: Math.PI / 2 }, { x: 18, z: 34, color: '#6e7772', rot: -Math.PI / 2 },
    ]
    for (const car of cars) {
      const group = new THREE.Group()
      group.position.set(car.x, 0, car.z)
      group.rotation.y = car.rot
      this.outdoor.add(group)
      const bodyMat = material(`car-${car.color}`, car.color, 0.44, 0.25)
      box(group, 'parked car body', 0, 0.68, 0, 3.65, 0.88, 1.72, bodyMat, true, true)
      box(group, 'car roof', -0.12, 1.3, 0, 1.9, 0.58, 1.42, material('car roof', '#676d6a', 0.4, 0.18), true)
      box(group, 'windscreen', 0.87, 1.31, 0, 0.055, 0.45, 1.18, glassMat)
      box(group, 'rear window', -1.07, 1.31, 0, 0.055, 0.43, 1.15, glassMat)
      const wheelMat = material('tyre', '#242727', 0.98)
      for (const wx of [-1.16, 1.16]) {
        for (const wz of [-0.88, 0.88]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 12), wheelMat)
          wheel.rotation.x = Math.PI / 2
          wheel.position.set(wx, 0.38, wz)
          wheel.castShadow = true
          group.add(wheel)
        }
      }
      addRect(this.outdoorRects, car.x, car.z, 4.3, 2.2, 0.12)
    }
  }

  private buildInteriors(): void {
    for (const location of CITY_LOCATIONS) {
      const room = new THREE.Group()
      room.name = `interior-${location.id}`
      room.visible = false
      this.interior.add(room)
      this.interiorRooms.set(location.id, room)
      this.makeRoomShell(room, location.category)
      switch (location.category) {
        case 'home': this.makeHomeInterior(room); break
        case 'cafe': this.makeCafeInterior(room); break
        case 'furniture': this.makeFurnitureInterior(room); break
        case 'clothing': this.makeClothingInterior(room); break
        case 'appliances': this.makeAppliancesInterior(room); break
        case 'grocery': this.makeGroceryInterior(room); break
      }
      this.addInteriorLight(room)
    }
    // An interior is deliberately a compact, open-front room. The wall colliders leave the entry side open.
    this.indoorRects.push(
      { minX: -7.2, maxX: -6.72, minZ: -5.7, maxZ: 5.6 },
      { minX: 6.72, maxX: 7.2, minZ: -5.7, maxZ: 5.6 },
      { minX: -7.2, maxX: 7.2, minZ: -5.7, maxZ: -5.22 },
    )
  }

  private makeRoomShell(room: THREE.Group, category: CityLocation['category']): void {
    const floorMat = material(`interior floor-${category}`, category === 'home' ? '#887e70' : '#aaa59b', 0.88)
    const wallMat = material(`interior wall-${category}`, category === 'home' ? '#c3bba9' : '#d0ccc2', 0.92)
    const backMat = material(`interior back-${category}`, '#bbb6ac', 0.91)
    box(room, 'interior floor', 0, -0.13, 0, 14, 0.26, 11.2, floorMat, false, true)
    box(room, 'left room wall', -6.95, 1.8, 0, 0.24, 3.6, 11.2, wallMat, false, true)
    box(room, 'right room wall', 6.95, 1.8, 0, 0.24, 3.6, 11.2, wallMat, false, true)
    box(room, 'back room wall', 0, 1.8, -5.52, 14, 3.6, 0.24, backMat, false, true)
    box(room, 'baseboard back', 0, 0.16, -5.36, 13.8, 0.22, 0.08, trimMat)
    for (const x of [-6.78, 6.78]) box(room, 'side baseboard', x, 0.16, 0, 0.08, 0.22, 10.9, trimMat)
    const ceiling = box(room, 'interior ceiling', 0, 3.72, 0, 14, 0.12, 11.2, material('interior ceiling', '#e0ddd4', 0.95))
    ceiling.visible = false // Open ceiling leaves the furniture legible from the game camera.
    room.add(new THREE.AmbientLight('#fff4df', 1.25))
  }

  private addInteriorLight(room: THREE.Group): void {
    const light = new THREE.PointLight('#fff0d8', 26, 18, 2)
    light.position.set(0, 3.25, -0.6)
    room.add(light)
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 12), material('ceiling fixture', '#d4cbb7', 0.42))
    fixture.position.set(0, 3.48, -0.6)
    room.add(fixture)
  }

  private makeHomeInterior(room: THREE.Group): void {
    const sofa = material('sofa fabric', '#77736a', 0.98)
    box(room, 'apartment sofa base', -3.2, 0.48, -1.9, 3.4, 0.82, 1.2, sofa, true)
    box(room, 'apartment sofa back', -3.2, 1.05, -2.38, 3.4, 1.12, 0.28, sofa, true)
    box(room, 'coffee table', -2.7, 0.47, 0.1, 2.35, 0.12, 1.15, woodMat, true)
    for (const x of [-3.65, -1.75]) box(room, 'coffee table leg', x, 0.22, 0.1, 0.12, 0.48, 0.12, woodMat)
    box(room, 'bed frame', 3.65, 0.38, -3.18, 3.4, 0.42, 2.8, woodMat, true)
    box(room, 'bed mattress', 3.65, 0.7, -3.18, 3.25, 0.28, 2.66, material('linen', '#c2bcae', 0.98), true)
    for (const x of [2.8, 4.35]) box(room, 'pillow', x, 0.94, -4.02, 1.1, 0.2, 0.68, material('pillow', '#ddd7ca', 0.99), true)
    this.addShelf(room, -5.65, -2.5, 3.4, 0.42)
    box(room, 'kitchen counter', 4.75, 0.9, 1.3, 2.4, 1.8, 0.72, material('cabinet', '#77766e', 0.8), true)
    box(room, 'kitchen worktop', 4.75, 1.86, 1.3, 2.55, 0.12, 0.84, trimMat)
  }

  private makeCafeInterior(room: THREE.Group): void {
    box(room, 'cafe counter base', 3.55, 0.72, -3.1, 4.6, 1.42, 1.1, material('cafe counter', '#5a5147', 0.78), true)
    box(room, 'cafe counter top', 3.55, 1.48, -3.1, 4.8, 0.15, 1.22, material('counter stone', '#aaa398', 0.62), true)
    box(room, 'coffee machine', 4.55, 2.05, -3.1, 0.85, 1.0, 0.68, metalMat, true)
    for (const [x, z] of [[-3.8, -2.7], [-0.2, -2.7], [-3.8, 1.4], [-0.2, 1.4]] as const) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.13, 16), woodMat)
      top.position.set(x, 1.02, z)
      top.castShadow = true
      room.add(top)
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.94, 8), metalMat)
      leg.position.set(x, 0.48, z)
      room.add(leg)
      this.addCafeChair(room, x - 1.05, z)
      this.addCafeChair(room, x + 1.05, z)
    }
    this.addShelf(room, -5.9, -3.3, 2.9, 0.44)
  }

  private addCafeChair(room: THREE.Group, x: number, z: number): void {
    box(room, 'cafe chair seat', x, 0.55, z, 0.8, 0.13, 0.76, woodMat, true)
    box(room, 'cafe chair back', x, 0.96, z - 0.29, 0.8, 0.74, 0.12, woodMat, true)
    for (const dx of [-0.29, 0.29]) for (const dz of [-0.25, 0.25]) box(room, 'cafe chair leg', x + dx, 0.27, z + dz, 0.075, 0.54, 0.075, metalMat)
  }

  private makeFurnitureInterior(room: THREE.Group): void {
    box(room, 'showroom rug', -2.8, 0.025, -0.4, 5.5, 0.05, 4.3, material('rug', '#797267', 0.99))
    box(room, 'display sofa', -3, 0.5, -1.1, 3.8, 0.8, 1.25, material('showroom sofa', '#8d887f', 0.99), true)
    box(room, 'display sofa back', -3, 1.12, -1.63, 3.8, 1.16, 0.28, material('showroom sofa', '#8d887f', 0.99), true)
    box(room, 'display coffee table', -2.8, 0.5, 1, 2.3, 0.14, 1.05, woodMat, true)
    this.addShelf(room, 5.85, 0, 4.2, 0.48)
    this.addShelf(room, -5.8, 0, 4.2, 0.48)
    box(room, 'sample armchair', 2.1, 0.54, 1.3, 1.55, 0.96, 1.2, material('armchair', '#777168', 0.98), true)
    box(room, 'display lamp stem', 4.3, 1.45, 0, 0.1, 2.8, 0.1, brassMat)
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 0.5, 12), material('lamp fabric', '#c2b8a5', 0.9))
    shade.position.set(4.3, 2.92, 0)
    room.add(shade)
  }

  private makeClothingInterior(room: THREE.Group): void {
    for (const x of [-4.7, -1.55, 1.6, 4.7]) {
      box(room, 'clothing rail upright', x, 1.58, -1.9, 0.1, 3.05, 0.1, metalMat)
      box(room, 'clothing rail', x, 3.02, -1.9, 2.55, 0.1, 0.1, metalMat)
      for (let i = 0; i < 5; i += 1) {
        const color = ['#666b68', '#827667', '#989387', '#596266', '#857e70'][i]
        const garment = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.16 + (i % 2) * 0.16, 0.13), material(`garment-${x}-${i}`, color, 0.98))
        garment.position.set(x - 0.82 + i * 0.4, 2.22, -1.9)
        room.add(garment)
        const hanger = box(room, 'clothes hanger', x - 0.82 + i * 0.4, 2.85, -1.9, 0.28, 0.035, 0.05, brassMat)
        hanger.rotation.z = Math.PI / 4
      }
    }
    box(room, 'clothing display table', 0, 0.62, 2.3, 4.2, 1.18, 1.15, woodMat, true)
    box(room, 'changing room divider', -5.4, 1.65, 3.55, 2.25, 3.3, 0.16, material('changing partition', '#9a9283', 0.96))
    box(room, 'mirror', 5.8, 1.75, 1.6, 0.08, 2.35, 1.45, glassLightMat)
  }

  private makeAppliancesInterior(room: THREE.Group): void {
    this.addAppliance(room, -4.9, -2.1, 'refrigerator', '#92938c')
    this.addAppliance(room, -1.75, -2.1, 'washing machine', '#b4b3ab')
    this.addAppliance(room, 1.65, -2.1, 'oven display', '#656a69')
    this.addAppliance(room, 4.9, -2.1, 'dishwasher', '#999a93')
    box(room, 'appliance display plinth', 0, 0.18, 0.85, 11.2, 0.34, 2.25, material('display plinth', '#858177', 0.85), true)
    this.addShelf(room, -5.8, 2.65, 3.2, 0.42)
    this.addShelf(room, 5.8, 2.65, 3.2, 0.42)
  }

  private addAppliance(room: THREE.Group, x: number, z: number, label: string, color: string): void {
    const appliance = material(`appliance-${label}`, color, 0.42, 0.12)
    box(room, label, x, 1.36, z, 2.05, 2.72, 1.35, appliance, true)
    box(room, 'appliance control strip', x, 2.55, z + 0.69, 1.78, 0.22, 0.055, metalMat)
    if (label === 'washing machine') {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.09, 18), glassMat)
      drum.rotation.x = Math.PI / 2
      drum.position.set(x, 1.35, z + 0.72)
      room.add(drum)
    } else if (label === 'oven display') {
      box(room, 'oven glass', x, 1.52, z + 0.71, 1.48, 1.15, 0.055, glassMat)
    } else if (label === 'refrigerator') {
      box(room, 'fridge handle', x + 0.72, 1.65, z + 0.72, 0.06, 1.08, 0.075, brassMat)
    }
  }

  private makeGroceryInterior(room: THREE.Group): void {
    for (const x of [-4.45, -1.48, 1.48, 4.45]) {
      box(room, 'grocery aisle base', x, 0.95, 0.1, 1.45, 1.9, 4.7, material('aisle shelf', '#77766f', 0.86), true)
      for (const y of [0.55, 1.05, 1.55, 2.05]) {
        box(room, 'grocery shelf', x, y, 0.1, 1.62, 0.08, 4.9, trimMat)
        for (let j = 0; j < 4; j += 1) {
          const product = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.28), material(`groceries-${x}-${y}-${j}`, ['#81796a', '#777d78', '#a28d70', '#77716a'][(j + Math.round(y * 2)) % 4], 0.88))
          product.position.set(x - 0.52 + j * 0.34, y + 0.2, -1.52 + j * 0.9)
          room.add(product)
        }
      }
    }
    box(room, 'checkout counter', 4.35, 0.62, 3.85, 3.3, 1.22, 0.9, material('checkout', '#716e66', 0.82), true)
    box(room, 'checkout top', 4.35, 1.28, 3.85, 3.42, 0.12, 1.0, trimMat)
    box(room, 'produce bin', -4.35, 0.58, 3.55, 3.2, 1.08, 1.25, woodMat, true)
    for (let i = 0; i < 12; i += 1) {
      const produce = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), material(`produce-${i}`, ['#82775b', '#696d5d', '#938365'][i % 3], 0.97))
      produce.position.set(-5.45 + (i % 4) * 0.72, 1.25 + Math.floor(i / 4) * 0.04, 3.15 + Math.floor(i / 4) * 0.38)
      room.add(produce)
    }
  }

  private addShelf(room: THREE.Group, x: number, z: number, height: number, width: number): void {
    const shelfMat = material('shelving', '#77756e', 0.84, 0.06)
    for (const dx of [-width / 2 + 0.08, width / 2 - 0.08]) box(room, 'shelf upright', x + dx, height / 2, z, 0.13, height, 0.42, shelfMat, true)
    for (let i = 0; i < 4; i += 1) box(room, 'shelf board', x, 0.35 + i * (height - 0.35) / 3, z, width, 0.11, 0.52, shelfMat, true)
  }
}

function stoneJointMat(): THREE.MeshStandardMaterial {
  return material('paving joint', '#aaa59b', 0.96)
}
