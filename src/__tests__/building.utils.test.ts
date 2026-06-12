import { describe, it, expect } from 'vitest'
import { PRODUCTION_TYPE } from '@/domains/building/building.utils'

describe('PRODUCTION_TYPE map', () => {
  it('maps every building type to a resource', () => {
    const expectedTypes = ['solar_panels', 'oxygen_generator', 'water_extractor', 'mine', 'greenhouse', 'research_lab']
    for (const type of expectedTypes) {
      expect(PRODUCTION_TYPE[type], `missing production type for ${type}`).toBeDefined()
    }
  })

  it('production resources are valid resource types', () => {
    const validResources = ['energy', 'oxygen', 'water', 'minerals', 'food', 'research_points']
    for (const [building, resource] of Object.entries(PRODUCTION_TYPE)) {
      expect(validResources, `${building} produces invalid resource ${resource}`).toContain(resource)
    }
  })
})

// Note: updateResourceRate uses Supabase, so we only test the map structure here.
// Integration tests would cover the actual DB operations.