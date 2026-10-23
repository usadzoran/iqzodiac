import { describe, expect, it } from 'vitest'
import { CITY_TRAFFIC_VEHICLE_COUNT, CityTraffic } from '../src/game/city-traffic'

describe('City Life ambient traffic', () => {
  it('creates six lightweight vehicles on the city loop', () => {
    const traffic = new CityTraffic()
    expect(traffic.group.children).toHaveLength(CITY_TRAFFIC_VEHICLE_COUNT)
    expect(traffic.group.children.every(vehicle => vehicle.userData.cityTrafficVehicle === true)).toBe(true)
    expect(traffic.group.children.every(vehicle => Math.abs(vehicle.position.x) <= 20 && Math.abs(vehicle.position.z) <= 20)).toBe(true)
  })

  it('advances vehicle positions and wheel rigs over time', () => {
    const traffic = new CityTraffic()
    const first = traffic.group.children[0]
    const before = first.position.clone()
    const wheels = first.userData.wheelRigs as Array<{ rotation: { z: number } }>
    const wheelBefore = wheels[0].rotation.z

    traffic.update(0.1)

    expect(first.position.distanceTo(before)).toBeGreaterThan(0.2)
    expect(wheels[0].rotation.z).not.toBe(wheelBefore)
  })
})
