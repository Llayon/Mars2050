import { describe, it, expect } from 'vitest'
import { generateMarsMap, getDefaultMapConfig } from '@/domains/map/map.generator'
import { DEFAULT_MAP_SEED } from '@/domains/map/map.config'

describe('map.generator (Deterministic Seeded Generation)', () => {
  it('uses DEFAULT_MAP_SEED (2050) in default config', () => {
    const config = getDefaultMapConfig()
    expect(config.seed).toBe(DEFAULT_MAP_SEED)
    expect(config.locationsCount).toBe(50)
  })

  it('generates byte-for-byte identical locations for identical seeds', () => {
    const configA = { width: 20, height: 20, locationsCount: 50, seed: 42 }
    const configB = { width: 20, height: 20, locationsCount: 50, seed: 42 }

    const locationsA = generateMarsMap(configA)
    const locationsB = generateMarsMap(configB)

    expect(locationsA).toEqual(locationsB)
  })

  it('generates different layouts for different seeds', () => {
    const locationsA = generateMarsMap({ width: 20, height: 20, locationsCount: 30, seed: 100 })
    const locationsB = generateMarsMap({ width: 20, height: 20, locationsCount: 30, seed: 200 })

    const coordsA = locationsA.map(l => `${l.x},${l.y}`)
    const coordsB = locationsB.map(l => `${l.x},${l.y}`)

    expect(coordsA).not.toEqual(coordsB)
  })

  it('each location has required fields and valid difficulty', () => {
    const locations = generateMarsMap(getDefaultMapConfig())
    expect(locations.length).toBe(50)

    for (const loc of locations) {
      expect(loc.name).toBeTypeOf('string')
      expect(loc.name.length).toBeGreaterThan(0)
      expect(loc.x).toBeGreaterThanOrEqual(0)
      expect(loc.y).toBeGreaterThanOrEqual(0)
      expect(loc.difficulty).toBeGreaterThanOrEqual(1)
      expect(loc.difficulty).toBeLessThanOrEqual(5)
      expect(loc.is_discovered).toBe(false)
    }
  })

  it('each location has resources with positive values', () => {
    const locations = generateMarsMap(getDefaultMapConfig())
    for (const loc of locations) {
      const resources = loc.resources as Record<string, number>
      expect(Object.keys(resources).length).toBeGreaterThan(0)
      for (const [key, value] of Object.entries(resources)) {
        if (key === '_cleared') continue
        expect(value, `${loc.name}.${key} should be positive`).toBeGreaterThan(0)
      }
    }
  })

  it('all generated locations have unique positions', () => {
    const locations = generateMarsMap(getDefaultMapConfig())
    const positions = new Set(locations.map(l => `${l.x},${l.y}`))
    expect(positions.size).toBe(locations.length)
  })
})