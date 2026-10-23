import { afterEach, describe, expect, it } from 'vitest'
import { CONFIG, DEFAULT_CONFIG } from '../src/game/config'
import { tuning } from '../src/game/tuning'

const defaults = Object.fromEntries(tuning.controls.map(control => [control.id, control.default]))

afterEach(() => {
  tuning.apply(defaults)
  tuning.activate('run')
})

describe('City Life Three.js tuning', () => {
  it('validates a complete patch before commit and never rewrites source defaults', () => {
    const before = tuning.read()
    const invalidPatches = [
      { 'player.walkSpeed': 999, 'camera.fov': 30 },
      { 'player.walkSpeed': 18 },
      { 'player.walkSpeed': 7.25 },
      { 'camera.distance': 70 },
      { 'camera.fov': 23 },
      { 'camera.follow': 0 },
      { 'camera.fov': Infinity },
      { unknown: 4 },
    ]
    for (const patch of invalidPatches) {
      expect(() => tuning.apply(patch)).toThrow()
      expect(tuning.read()).toEqual(before)
    }
    tuning.apply({ 'player.walkSpeed': 10, 'player.sprintSpeed': 14 })
    expect(CONFIG.player.walkSpeed).toBe(10)
    expect(CONFIG.player.sprintSpeed).toBe(14)
    expect(DEFAULT_CONFIG.player.walkSpeed).toBe(7)
    const applied = tuning.read()
    tuning.apply({ 'player.walkSpeed': 10 })
    expect(tuning.read()).toEqual(applied)
  })

  it('updates the camera values that the exploration camera actually consumes', () => {
    tuning.apply({ 'camera.fov': 42, 'camera.distance': 55, 'camera.follow': 15 })
    expect(CONFIG.camera.fov).toBe(42)
    expect(CONFIG.camera.distance).toBe(55)
    expect(CONFIG.camera.follow).toBe(15)
    expect(DEFAULT_CONFIG.camera.fov).toBe(34)
    expect(DEFAULT_CONFIG.camera.distance).toBe(48)
    expect(tuning.unranked).toBe(false)
  })

  it('latches gameplay movement changes until a clean boundary resets the tuning run', () => {
    tuning.activate('run')
    tuning.apply({ 'player.walkSpeed': 8 })
    expect(tuning.unranked).toBe(true)
    tuning.apply(defaults)
    expect(tuning.unranked).toBe(true)
    tuning.activate('run')
    expect(tuning.unranked).toBe(false)
  })
})
