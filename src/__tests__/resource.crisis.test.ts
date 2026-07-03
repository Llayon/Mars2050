import { describe, expect, it } from 'vitest'
import { buildEconomyCrisisRecommendations } from '@/domains/resource/resource.crisis'
import type { BuildingRateBreakdown, ResourceRateMap, ScarcityCalculation } from '@/domains/resource/resource.economy'
import type { ResourceRow, ResourceTypeKey } from '@/domains/resource/resource.types'

const colonyId = '550e8400-e29b-41d4-a716-446655440000'

function resource(type: ResourceTypeKey, amount: number): ResourceRow {
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

describe('buildEconomyCrisisRecommendations', () => {
  it('prioritizes survival need shortages', () => {
    const recommendations = buildEconomyCrisisRecommendations({
      resources: [resource('water', 1), resource('oxygen', 10), resource('food', 10)],
      net: {},
      scarcity: {},
      buildings: [],
      armyUpkeep: {},
      populationNeeds: [{
        tier: 'worker',
        population: 10,
        housingCapacity: 10,
        happiness: 25,
        satisfaction: { basic: 0.44, comfort: 1, luxury: 1 },
        needs: [
          { resource: 'water', amountPer10: 3, category: 'basic', required: 3, available: 1, satisfaction: 1 / 3 },
          { resource: 'oxygen', amountPer10: 2, category: 'basic', required: 2, available: 10, satisfaction: 1 },
        ],
      }],
    })

    expect(recommendations[0]).toEqual(expect.objectContaining({
      code: 'basic_need_shortage',
      severity: 'critical',
      resource: 'water',
      tier: 'worker',
    }))
  })

  it('reports input throttling and fast resource depletion', () => {
    const scarcity: ScarcityCalculation['scarcity'] = {
      energy: {
        stock: 0,
        productionRate: 1,
        demandRate: 5,
        windowHours: 1,
        availableAmount: 1,
        demandedAmount: 5,
        factor: 0.2,
      },
    }
    const buildings: BuildingRateBreakdown[] = [{
      buildingId: 'greenhouse-1',
      buildingType: 'greenhouse',
      production: { food: 1 },
      consumption: { energy: 1 },
      inputThrottle: 0.2,
      throttleReasons: { energy: 0.2 },
    }]
    const net: ResourceRateMap = { water: -10 }

    const recommendations = buildEconomyCrisisRecommendations({
      resources: [resource('water', 5), resource('energy', 0)],
      net,
      scarcity,
      buildings,
      populationNeeds: [],
      armyUpkeep: {},
    })

    expect(recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'input_scarcity', resource: 'energy', severity: 'critical' }),
      expect.objectContaining({ code: 'resource_depletion', resource: 'water', severity: 'critical' }),
    ]))
  })
})
