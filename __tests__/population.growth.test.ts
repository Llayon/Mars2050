import { describe, it, expect, vi } from 'vitest'
import { calculateTierHappiness, calculateGrowthDelta } from '@/domains/population/population.growth'
import type { ResourceRow } from '@/domains/resource/resource.types'

describe('Population Growth Logic', () => {
  describe('calculateTierHappiness', () => {
    it('returns 50 if population is 0', () => {
      expect(calculateTierHappiness('worker', 0, [], 100)).toBe(50)
    })

    it('calculates full happiness when basic needs are met', () => {
      const resources: ResourceRow[] = [
        { id: '1', colony_id: 'c1', type: 'water', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' },
        { id: '2', colony_id: 'c1', type: 'oxygen', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' },
        { id: '3', colony_id: 'c1', type: 'food', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' }
      ]
      // base (50) + basic (30) = 80
      expect(calculateTierHappiness('worker', 10, resources, 10)).toBe(80)
    })

    it('penalizes overcrowding', () => {
      const resources: ResourceRow[] = [
        { id: '1', colony_id: 'c1', type: 'water', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' },
        { id: '2', colony_id: 'c1', type: 'oxygen', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' },
        { id: '3', colony_id: 'c1', type: 'food', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' }
      ]
      // 80 - 20 (overcrowded) = 60
      expect(calculateTierHappiness('worker', 20, resources, 10)).toBe(60)
    })

    it('calculates full happiness for directors with luxury needs', () => {
      const resources: ResourceRow[] = [
        { id: '1', colony_id: 'c1', type: 'water', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' },
        { id: '2', colony_id: 'c1', type: 'oxygen', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' },
        { id: '3', colony_id: 'c1', type: 'food', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' },
        { id: '4', colony_id: 'c1', type: 'consumer_goods', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' },
        { id: '5', colony_id: 'c1', type: 'databanks', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' },
        { id: '6', colony_id: 'c1', type: 'nanomaterials', amount: 100, capacity: 1000, production_rate: 0, consumption_rate: 0, updated_at: '' }
      ]
      // base(50) + basic(30) + comfort(15) + luxury(10) = 105 -> capped at 100
      expect(calculateTierHappiness('director', 10, resources, 10)).toBe(100)
    })
  })

  describe('calculateGrowthDelta', () => {
    it('returns positive growth for high happiness', () => {
      expect(calculateGrowthDelta(95, 10)).toBe(2.0)
    })

    it('returns 0 if no free housing, even if happy', () => {
      expect(calculateGrowthDelta(95, 0)).toBe(0)
    })

    it('returns negative growth for low happiness, regardless of housing', () => {
      expect(calculateGrowthDelta(10, 10)).toBe(-0.5)
      expect(calculateGrowthDelta(10, 0)).toBe(-0.5)
    })
  })
})
