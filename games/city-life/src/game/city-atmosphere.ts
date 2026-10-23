import * as THREE from 'three'

type Ripple = { mesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>; phase: number }
type Firefly = { x: number; y: number; z: number; phase: number; color: THREE.Color }

/** Small ambient details keep the plaza lively while staying cheap to render. */
export class CityAtmosphere {
  readonly group = new THREE.Group()
  private readonly ripples: Ripple[] = []
  private readonly fireflies: Firefly[] = []
  private readonly lights: THREE.InstancedMesh
  private readonly dummy = new THREE.Object3D()
  private readonly scratchColor = new THREE.Color()
  private elapsed = 0

  constructor() {
    this.group.name = 'city-ambient-effects'
    const ringGeometry = new THREE.TorusGeometry(0.42, 0.026, 6, 32)
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: '#b9e8d8', transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }))
      ring.name = `fountain-ripple-${index + 1}`
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.635
      ring.renderOrder = 8
      this.group.add(ring)
      this.ripples.push({ mesh: ring, phase: index * 0.8 })
    }

    const count = 16
    this.lights = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#f3e9bd', toneMapped: false }),
      count,
    )
    this.lights.name = 'plaza-fireflies'
    this.lights.frustumCulled = false
    this.lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.lights.renderOrder = 7
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963229728653
      const radius = 3.2 + (index % 4) * 1.25
      const fly: Firefly = {
        x: Math.cos(angle) * radius,
        y: 0.9 + (index % 3) * 0.38,
        z: Math.sin(angle) * radius,
        phase: index * 0.73,
        color: new THREE.Color(index % 3 === 0 ? '#c8f0d7' : '#f3e9bd'),
      }
      this.fireflies.push(fly)
      this.lights.setColorAt(index, fly.color)
    }
    this.group.add(this.lights)
    this.update(0)
  }

  update(dt: number): void {
    this.elapsed += THREE.MathUtils.clamp(dt, 0, 0.1)
    for (const ripple of this.ripples) {
      const progress = ((this.elapsed + ripple.phase) % 2.4) / 2.4
      const scale = 0.8 + progress * 3.1
      ripple.mesh.scale.set(scale, scale, scale)
      ripple.mesh.material.opacity = (1 - progress) * 0.36
    }

    this.fireflies.forEach((fly, index) => {
      const wave = this.elapsed * 1.7 + fly.phase
      this.dummy.position.set(fly.x + Math.sin(wave * 0.7) * 0.42, fly.y + Math.sin(wave) * 0.24, fly.z + Math.cos(wave * 0.63) * 0.42)
      const pulse = 0.55 + (Math.sin(wave * 2.1) + 1) * 0.22
      this.dummy.scale.setScalar(pulse)
      this.dummy.rotation.set(0, wave, 0)
      this.dummy.updateMatrix()
      this.lights.setMatrixAt(index, this.dummy.matrix)
      this.scratchColor.copy(fly.color).multiplyScalar(pulse)
      this.lights.setColorAt(index, this.scratchColor)
    })
    this.lights.instanceMatrix.needsUpdate = true
    if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true
  }
}
