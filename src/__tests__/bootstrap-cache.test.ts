import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColonyBootstrapPayload } from '@/domains/colony/colony.types'
import {
  BOOTSTRAP_CACHE_SCHEMA_VERSION,
  BOOTSTRAP_CACHE_TTL_MS,
  clearBootstrapCache,
  readBootstrapCache,
  writeBootstrapCache,
} from '@/lib/bootstrap-cache'

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440001'
const NOW = new Date('2026-07-04T12:00:00.000Z').getTime()
let storage = new Map<string, string>()

const payload: ColonyBootstrapPayload = {
  colony: {
    id: COLONY_ID,
    name: 'Cached Alpha',
    level: 1,
    experience: 0,
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    last_calc_at: '2026-07-04T11:59:00.000Z',
    created_at: '2026-07-04T11:00:00.000Z',
    terrain_grid: [{ x: 0, y: 0, t: 'regolith' }],
    unlocked_radius: 5,
  },
  resources: [{
    id: '550e8400-e29b-41d4-a716-446655440010',
    colony_id: COLONY_ID,
    type: 'energy',
    amount: 100,
    capacity: 200,
    production_rate: 5,
    consumption_rate: 1,
    updated_at: '2026-07-04T11:59:00.000Z',
  }],
  buildings: [{
    id: '550e8400-e29b-41d4-a716-446655440020',
    colony_id: COLONY_ID,
    type: 'solar_panels',
    name: 'Solar Panel',
    level: 1,
    is_active: true,
    x: 0,
    y: 0,
    staffing_mode: 'auto',
    assigned_workers: 0,
    work_priority: 'normal',
    paused: false,
    created_at: '2026-07-04T11:00:00.000Z',
    updated_at: '2026-07-04T11:59:00.000Z',
  }],
  population: null,
}

function key(): string {
  return `mars2050_bootstrap:${COLONY_ID}`
}

beforeEach(() => {
  vi.restoreAllMocks()
  storage = new Map<string, string>()
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (itemKey: string) => storage.get(itemKey) ?? null,
      setItem: (itemKey: string, value: string) => { storage.set(itemKey, value) },
      removeItem: (itemKey: string) => { storage.delete(itemKey) },
    },
  })
})

describe('bootstrap cache', () => {
  it('stores and reads a valid bootstrap payload', () => {
    writeBootstrapCache(COLONY_ID, payload)

    expect(readBootstrapCache(COLONY_ID)?.colony.name).toBe('Cached Alpha')
  })

  it('ignores corrupted cache data', () => {
    storage.set(key(), '{broken')

    expect(readBootstrapCache(COLONY_ID)).toBeNull()
  })

  it('ignores wrong schema versions', () => {
    storage.set(key(), JSON.stringify({ schemaVersion: 999, savedAt: NOW, data: payload }))

    expect(readBootstrapCache(COLONY_ID)).toBeNull()
  })

  it('ignores and clears expired cache data', () => {
    storage.set(key(), JSON.stringify({
      schemaVersion: BOOTSTRAP_CACHE_SCHEMA_VERSION,
      savedAt: NOW - BOOTSTRAP_CACHE_TTL_MS - 1,
      data: payload,
    }))

    expect(readBootstrapCache(COLONY_ID)).toBeNull()
    expect(storage.has(key())).toBe(false)
  })

  it('clears cache by colony id', () => {
    writeBootstrapCache(COLONY_ID, payload)

    clearBootstrapCache(COLONY_ID)

    expect(readBootstrapCache(COLONY_ID)).toBeNull()
  })
})
