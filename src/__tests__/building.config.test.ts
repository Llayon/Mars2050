import { describe, it, expect } from 'vitest'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import type { ResourceTypeKey } from '@/domains/resource/resource.types'
import type { BuildingTypeKey } from '@/domains/building/building.types'
import type { TierConfig } from '@/domains/population/population.types'

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

  it('every unlockedByTier tier is reachable', () => {
    const popTiers = ['worker', 'technician', 'scientist', 'director']
    for (const [key, config] of Object.entries(BUILDING_TYPES)) {
      if (config.unlockedByTier) {
        expect(popTiers).toContain(config.unlockedByTier)
      }
    }
  })

  it('every workforce tier has at least one housing source', () => {
    for (const [tier, config] of Object.entries(POPULATION_TIERS)) {
      const housingPerBuilding = (config as TierConfig).housingPerBuilding
      expect(Object.keys(housingPerBuilding).length, `${tier} has no housing source`).toBeGreaterThan(0)
      for (const buildingType of Object.keys(housingPerBuilding)) {
        expect(BUILDING_TYPES[buildingType as BuildingTypeKey], `Housing building ${buildingType} not found in config`).toBeDefined()
      }
    }
  })

  it('every produced advanced resource has at least one consumer or need', () => {
    const advancedResources = ['consumer_goods', 'rare_metals', 'databanks', 'nanomaterials']
    const consumers = new Set<string>()

    for (const [key, config] of Object.entries(BUILDING_TYPES)) {
      for (const res of Object.keys(config.consumption)) {
        consumers.add(res)
      }
      for (const res of Object.keys(config.cost)) {
        consumers.add(res)
      }
    }

    for (const [tier, config] of Object.entries(POPULATION_TIERS)) {
      for (const need of (config as TierConfig).needs) {
        consumers.add(need.resource)
      }
    }

    for (const res of advancedResources) {
      expect(consumers.has(res), `Advanced resource ${res} has no consumers or needs`).toBe(true)
    }
  })

  it('every consumed advanced resource has at least one producer', () => {
    const advancedResources = ['consumer_goods', 'rare_metals', 'databanks', 'nanomaterials']
    const producers = new Set<string>()

    for (const [key, config] of Object.entries(BUILDING_TYPES)) {
      for (const res of Object.keys(config.production)) {
        producers.add(res)
      }
    }

    for (const res of advancedResources) {
      expect(producers.has(res), `Advanced resource ${res} is consumed but has no producers in config`).toBe(true)
    }
  })
})
