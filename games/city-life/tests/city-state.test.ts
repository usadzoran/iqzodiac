import { describe, expect, it } from 'vitest'
import { CITY_STATE_KEY, loadCityState, parseCityState, saveCityState } from '../src/game/city-state'

const ids = ['home', 'cafe', 'furniture'] as const

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
  }
}

describe('City Life local exploration state', () => {
  it('uses a safe default for empty, malformed, or unsupported data', () => {
    expect(parseCityState(null, ids)).toMatchObject({ version: 1, x: 0, z: 0, selectedLocationId: '', visitedLocationIds: [] })
    expect(parseCityState('{broken', ids).visitedLocationIds).toEqual([])
    expect(parseCityState(JSON.stringify({ version: 2, x: 9 }), ids).x).toBe(0)
  })

  it('clamps coordinates and only accepts known destination IDs', () => {
    const state = parseCityState(JSON.stringify({ version: 1, x: 999, z: -999, selectedLocationId: 'missing', visitedLocationIds: ['cafe', 'cafe', 'missing', 4] }), ids)
    expect(state).toEqual({ version: 1, x: 56, z: -56, selectedLocationId: '', visitedLocationIds: ['cafe'] })
  })

  it('round-trips the exploration record through browser-like storage', () => {
    const storage = memoryStorage()
    saveCityState({ version: 1, x: 17.5, z: -4, selectedLocationId: 'home', visitedLocationIds: ['home', 'cafe', 'home'] }, storage)
    expect(storage.getItem(CITY_STATE_KEY)).toBeTruthy()
    expect(loadCityState(storage, ids)).toEqual({ version: 1, x: 17.5, z: -4, selectedLocationId: 'home', visitedLocationIds: ['home', 'cafe'] })
  })
})
