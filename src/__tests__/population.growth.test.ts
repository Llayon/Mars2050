import { describe, it, expect } from 'vitest'
import { calculateTierHappiness, calculateNeedsSatisfaction } from '@/domains/population/population.growth'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { POPULATION_TIERS } from '@/domains/population/population.config'

const colonyId = '550e8400-e29b-41d4-a716-446655440000'

function resource(type: ResourceRow['type'], amount: number): ResourceRow {
  return {
    id: `res-${type}`,
    colony_id: colonyId,
    type,
    amount,
    capacity: 1000,
    production_rate: 0,
    consumption_rate: 0,
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('population growth happiness', () => {
  it('penalizes workers sharply when basic needs are missing', () => {
    const happiness = calculateTierHappiness('worker', 10, [
      resource('water', 0),
      resource('oxygen', 0),
      resource('food', 0),
    ], 10)

    expect(happiness).toBe(0)
  })

  it('keeps satisfied workers at high happiness', () => {
    const happiness = calculateTierHappiness('worker', 10, [
      resource('water', 100),
      resource('oxygen', 100),
      resource('food', 100),
    ], 10)

    expect(happiness).toBe(80)
  })

  it('calculates partial need satisfaction deterministically', () => {
    const satisfaction = calculateNeedsSatisfaction(POPULATION_TIERS.worker.needs, 10, [
      resource('water', 3),
      resource('oxygen', 1),
      resource('food', 0),
    ])

    expect(satisfaction).toBeCloseTo(0.5)
  })
})
