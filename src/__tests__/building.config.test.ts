import { describe, it, expect } from 'vitest'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { ResourceTypeKey } from '@/domains/resource/resource.types'

describe('building.config', () => {
  it('every building type has a name', () => {
    for (const [key, config] of Object.entries(BUILDING_TYPES)) {
      expect(config.name, `${key} missing name`).toBeTypeOf('string')
      expect(config.name.length, `${key} name too short`).toBeGreaterThan(0)
    }
  })

  it('every building has a cost with positive values', () => {
    for (const [key, config] of Object.entries(BUILDING_TYPES)) {
      expect(Object.keys(config.cost).length, `${key} has no cost`).toBeGreaterThan(0)
      for (const [resource, amount] of Object.entries(config.cost)) {
        expect(amount, `${key}.cost.${resource} must be positive`).toBeGreaterThan(0)
      }
    }
  })

  it('every building (except habitats and special structures) has a production rate', () => {
    const nonProducers = ['habitat', 'habitat_mk2', 'habitat_mk3', 'community_hall', 'vehicle_bay', 'university', 'hq', 'spaceport', 'military_academy', 'executive_dome']
    for (const [key, config] of Object.entries(BUILDING_TYPES)) {
      if (nonProducers.includes(key)) continue
      expect(Object.keys(config.production).length, `${key} has no production`).toBeGreaterThan(0)
      for (const [resource, amount] of Object.entries(config.production)) {
        expect(amount, `${key}.production.${resource} must be positive`).toBeGreaterThan(0)
      }
    }
  })

  it('consumption values are non-negative', () => {
    for (const [key, config] of Object.entries(BUILDING_TYPES)) {
      for (const [resource, amount] of Object.entries(config.consumption)) {
        expect(amount, `${key}.consumption.${resource} must be >= 0`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('no building produces the same resource it consumes', () => {
    for (const [key, config] of Object.entries(BUILDING_TYPES)) {
      for (const [produced] of Object.entries(config.production)) {
        expect(config.consumption[produced as ResourceTypeKey], `${key} produces and consumes ${produced}`).toBeUndefined()
      }
    }
  })
})