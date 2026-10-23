export type CityState = {
  version: 1
  x: number
  z: number
  selectedLocationId: string
  visitedLocationIds: string[]
}

export const CITY_STATE_KEY = 'citylife.exploration.v1'
const DEFAULT_STATE: CityState = { version: 1, x: 0, z: 0, selectedLocationId: '', visitedLocationIds: [] }

/** Parse untrusted browser storage into the small local-only exploration record. */
export function parseCityState(raw: string | null, allowedIds: readonly string[] = []): CityState {
  if (!raw) return { ...DEFAULT_STATE, visitedLocationIds: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_STATE, visitedLocationIds: [] }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_STATE, visitedLocationIds: [] }
  const data = parsed as Record<string, unknown>
  if (data.version !== 1) return { ...DEFAULT_STATE, visitedLocationIds: [] }
  const validId = (value: unknown): value is string => typeof value === 'string' && (allowedIds.length === 0 || allowedIds.includes(value))
  const visits = Array.isArray(data.visitedLocationIds) ? data.visitedLocationIds.filter(validId).slice(0, 100) : []
  return {
    version: 1,
    x: typeof data.x === 'number' && Number.isFinite(data.x) ? Math.max(-56, Math.min(56, data.x)) : 0,
    z: typeof data.z === 'number' && Number.isFinite(data.z) ? Math.max(-56, Math.min(56, data.z)) : 0,
    selectedLocationId: validId(data.selectedLocationId) ? data.selectedLocationId : '',
    visitedLocationIds: [...new Set(visits)],
  }
}

export function loadCityState(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage, allowedIds: readonly string[] = []): CityState {
  try {
    return parseCityState(storage?.getItem(CITY_STATE_KEY) ?? null, allowedIds)
  } catch {
    return { ...DEFAULT_STATE, visitedLocationIds: [] }
  }
}

export function saveCityState(state: CityState, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(CITY_STATE_KEY, JSON.stringify({
      version: 1,
      x: Math.max(-56, Math.min(56, state.x)),
      z: Math.max(-56, Math.min(56, state.z)),
      selectedLocationId: state.selectedLocationId,
      visitedLocationIds: [...new Set(state.visitedLocationIds)].slice(0, 100),
    }))
  } catch {
    // The city remains playable when localStorage is unavailable.
  }
}
