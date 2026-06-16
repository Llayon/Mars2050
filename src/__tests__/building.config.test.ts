import { describe, it, expect } from 'vitest'
import { BUILDING_TYPES, BUILDING_PRODUCTION_MAP, BUILDING_CONSUMPTION_MAP } from '@/domains/building/building.config'
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

  it('every building (except habitat) has a production rate', () => {
    for (const [key, config] of Object.entries(BUILDING_TYPES)) {
      if (key === 'habitat') continue
      expect(Object.keys(config.production).length, `${key} has no production`).toBeGreaterThan(0)
      for (const [resource, amount] of Object.entries(config.production)) {
        expect(amount, `${key}.production.${resource} must be positive`).toBeGreaterThan(0)
      }
    }
  })

  it('BUILDING_PRODUCTION_MAP matches BUILDING_TYPES keys', () => {
    const typeKeys = Object.keys(BUILDING_TYPES).sort()
    const prodKeys = Object.keys(BUILDING_PRODUCTION_MAP).sort()
    expect(prodKeys).toEqual(typeKeys)
  })

  it('BUILDING_CONSUMPTION_MAP matches BUILDING_TYPES keys', () => {
    const typeKeys = Object.keys(BUILDING_TYPES).sort()
    const consKeys = Object.keys(BUILDING_CONSUMPTION_MAP).sort()
    expect(consKeys).toEqual(typeKeys)
  })

  it('consumption values are non-negative', () => {
    for (const [building, resources] of Object.entries(BUILDING_CONSUMPTION_MAP)) {
      for (const [resource, amount] of Object.entries(resources)) {
        expect(amount, `${building}.consumption.${resource} must be >= 0`).toBeGreaterThanOrEqual(0)
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