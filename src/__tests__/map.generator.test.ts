import { describe, it, expect } from 'vitest'
import { generateMarsMap, getDefaultMapConfig } from '@/domains/map/map.generator'

describe('map.generator', () => {
  it('generates the configured number of locations', () => {
    const config = getDefaultMapConfig()
    const locations = generateMarsMap(config)
    expect(locations.length).toBe(config.locationsCount)
  })

  it('each location has required fields', () => {
    const locations = generateMarsMap(getDefaultMapConfig())
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
        if (key === '_cleared') continue;
        expect(value, `${loc.name}.${key} should be positive`).toBeGreaterThan(0)
      }
    }
  })

  it('locations have different positions', () => {
    const locations = generateMarsMap(getDefaultMapConfig())
    const positions = new Set(locations.map(l => `${l.x},${l.y}`))
    expect(positions.size).toBe(locations.length)
  })

  it('custom config works', () => {
    const config = { width: 5, height: 5, locationsCount: 3 }
    const locations = generateMarsMap(config)
    expect(locations.length).toBe(3)
    for (const loc of locations) {
      expect(loc.x).toBeLessThan(5)
      expect(loc.y).toBeLessThan(5)
    }
  })
})