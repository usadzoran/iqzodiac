import * as THREE from 'three'

export const CITY_TRAFFIC_VEHICLE_COUNT = 6

const LOOP_POINTS = [
  new THREE.Vector3(-16.5, 0, -18),
  new THREE.Vector3(16.5, 0, -18),
  new THREE.Vector3(18, 0, -16.5),
  new THREE.Vector3(18, 0, 16.5),
  new THREE.Vector3(16.5, 0, 18),
  new THREE.Vector3(-16.5, 0, 18),
  new THREE.Vector3(-18, 0, 16.5),
  new THREE.Vector3(-18, 0, -16.5),
]

const BODY_COLORS = ['#52766d', '#b98d68', '#6f8190', '#947a70', '#858b70', '#b9aa91']
const GLASS = new THREE.MeshStandardMaterial({ color: '#34474a', roughness: 0.24, metalness: 0.18 })
const TYRE = new THREE.MeshStandardMaterial({ color: '#252827', roughness: 0.96 })
const TRIM = new THREE.MeshStandardMaterial({ color: '#777b76', roughness: 0.55, metalness: 0.42 })
const HEADLIGHT = new THREE.MeshBasicMaterial({ color: '#ffe6a6', toneMapped: false })
const TAILLIGHT = new THREE.MeshBasicMaterial({ color: '#ef7663', toneMapped: false })
const BODY_GEOMETRY = new THREE.BoxGeometry(3.45, 0.72, 1.55)
const ROOF_GEOMETRY = new THREE.BoxGeometry(1.75, 0.48, 1.22)
const WINDOW_GEOMETRY = new THREE.BoxGeometry(0.055, 0.34, 1.17)
const SIDE_WINDOW_GEOMETRY = new THREE.BoxGeometry(1.17, 0.31, 0.035)
const WHEEL_GEOMETRY = new THREE.CylinderGeometry(0.31, 0.31, 0.18, 14)

type MovingCar = { root: THREE.Group; wheels: THREE.Group[] }

/** Six lightweight low-poly cars circulate around the central street loop without blocking exploration. */
export class CityTraffic {
  readonly group = new THREE.Group()
  private readonly cars: MovingCar[] = []
  private readonly route = new THREE.CatmullRomCurve3(LOOP_POINTS, true, 'centripetal', 0.25)
  private readonly routeLength = this.route.getLength()
  private readonly speed = 4.55
  private elapsed = 0

  constructor() {
    this.group.name = 'city-moving-traffic'
    for (let index = 0; index < CITY_TRAFFIC_VEHICLE_COUNT; index += 1) {
      const root = this.createCar(index)
      root.userData.cityTrafficVehicle = true
      root.userData.trafficIndex = index
      this.cars.push({ root, wheels: root.userData.wheelRigs as THREE.Group[] })
      this.group.add(root)
    }
    this.update(0)
  }

  update(dt: number): void {
    this.elapsed += THREE.MathUtils.clamp(dt, 0, 0.1)
    const wheelTurn = -(this.elapsed * this.speed) / 0.31
    this.cars.forEach((car, index) => {
      const progress = (index / this.cars.length + (this.elapsed * this.speed) / this.routeLength) % 1
      const position = this.route.getPointAt(progress)
      const tangent = this.route.getTangentAt(progress)
      car.root.position.set(position.x, 0, position.z)
      car.root.rotation.y = Math.atan2(-tangent.z, tangent.x)
      for (const wheel of car.wheels) wheel.rotation.z = wheelTurn
    })
  }

  private createCar(index: number): THREE.Group {
    const root = new THREE.Group()
    root.name = `city-traffic-vehicle-${index + 1}`
    const body = new THREE.MeshStandardMaterial({ color: BODY_COLORS[index % BODY_COLORS.length], roughness: 0.43, metalness: 0.2 })
    body.name = `city-traffic-body-${index + 1}`

    addMesh(root, BODY_GEOMETRY, body, 0, 0.69, 0, true)
    addMesh(root, ROOF_GEOMETRY, body, -0.12, 1.25, 0, true)
    addMesh(root, WINDOW_GEOMETRY, GLASS, 0.79, 1.23, 0, false)
    addMesh(root, WINDOW_GEOMETRY, GLASS, -1.02, 1.23, 0, false)
    for (const side of [-1, 1]) addMesh(root, SIDE_WINDOW_GEOMETRY, GLASS, -0.12, 1.23, side * 0.63, false)
    for (const side of [-1, 1]) {
      addMesh(root, new THREE.BoxGeometry(0.08, 0.16, 0.24), HEADLIGHT, 1.74, 0.61, side * 0.47, false)
      addMesh(root, new THREE.BoxGeometry(0.08, 0.17, 0.24), TAILLIGHT, -1.74, 0.61, side * 0.47, false)
    }
    addMesh(root, new THREE.BoxGeometry(0.12, 0.13, 1.42), TRIM, 1.76, 0.35, 0, false)
    addMesh(root, new THREE.BoxGeometry(0.12, 0.13, 1.42), TRIM, -1.76, 0.35, 0, false)

    const wheelRigs: THREE.Group[] = []
    for (const x of [-1.12, 1.12]) {
      for (const z of [-0.79, 0.79]) {
        const rig = new THREE.Group()
        rig.position.set(x, 0.32, z)
        const tyre = new THREE.Mesh(WHEEL_GEOMETRY, TYRE)
        tyre.rotation.x = Math.PI / 2
        tyre.castShadow = true
        rig.add(tyre)
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.19, 10), TRIM)
        hub.rotation.x = Math.PI / 2
        rig.add(hub)
        root.add(rig)
        wheelRigs.push(rig)
      }
    }
    root.userData.wheelRigs = wheelRigs
    return root
  }
}

function addMesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, castShadow: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = castShadow
  mesh.receiveShadow = castShadow
  parent.add(mesh)
  return mesh
}
