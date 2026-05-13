import { describe, it, expect } from 'vitest'
import { EXPLORATION_COST, EXPLORATION_BASE_REWARD } from '@/domains/map/map.config'
import { RESOURCE_ICONS, RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { LOCATION_COLORS, LOCATION_LABELS } from '@/domains/map/map.config'

describe('map.config', () => {
  it('exploration costs exist for levels 1-5', () => {
    for (let i = 1; i <= 5; i++) {
      expect(EXPLORATION_COST[i], `missing cost for difficulty ${i}`).toBeDefined()
    }
  })

  it('exploration costs increase with difficulty', () => {
    for (let i = 2; i <= 5; i++) {
      const prevEnergy = EXPLORATION_COST[i - 1].energy
      const currEnergy = EXPLORATION_COST[i].energy
      expect(currEnergy, `cost should increase from level ${i - 1} to ${i}`).toBeGreaterThan(prevEnergy)
    }
  })

  it('all exploration costs use energy', () => {
    for (let i = 1; i <= 5; i++) {
      expect(EXPLORATION_COST[i].energy, `level ${i} missing energy cost`).toBeGreaterThan(0)
      expect(Object.keys(EXPLORATION_COST[i])).toEqual(['energy'])
    }
  })

  it('EXPLORATION_BASE_REWARD is positive', () => {
    expect(EXPLORATION_BASE_REWARD).toBeGreaterThan(0)
  })

  it('LOCATION_COLORS covers all 5 terrain types', () => {
    const expectedTypes = ['plains', 'mountains', 'canyon', 'crater', 'ice_cap'] as const
    for (const type of expectedTypes) {
      expect(LOCATION_COLORS[type], `missing color for ${type}`).toBeDefined()
    }
  })

  it('LOCATION_LABELS covers all 5 terrain types', () => {
    const expectedTypes = ['plains', 'mountains', 'canyon', 'crater', 'ice_cap'] as const
    for (const type of expectedTypes) {
      expect(LOCATION_LABELS[type], `missing label for ${type}`).toBeTypeOf('string')
    }
  })
})

describe('resource.types', () => {
  const resourceKeys = ['oxygen', 'water', 'energy', 'minerals', 'food', 'research_points'] as const

  it('RESOURCE_ICONS has all resource types', () => {
    for (const key of resourceKeys) {
      expect(RESOURCE_ICONS[key], `missing icon for ${key}`).toBeDefined()
    }
  })

  it('RESOURCE_NAMES has all resource types', () => {
    for (const key of resourceKeys) {
      expect(RESOURCE_NAMES[key], `missing name for ${key}`).toBeTypeOf('string')
    }
  })

  it('RESOURCE_NAMES values are non-empty Russian strings', () => {
    for (const [key, name] of Object.entries(RESOURCE_NAMES)) {
      expect((name as string).length, `${key} name too short`).toBeGreaterThan(1)
    }
  })
})