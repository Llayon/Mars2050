import { describe, it, expect } from 'vitest'
import { applyInputScarcity, type BuildingRateInput } from '@/domains/resource/resource.economy'
import type { ResourceRow } from '@/domains/resource/resource.types'

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

describe('applyInputScarcity', () => {
  it('scales building output and inputs by the scarcest input', () => {
    const buildings: BuildingRateInput[] = [{
      buildingId: 'greenhouse-1',
      buildingType: 'greenhouse',
      production: { food: 6 },
      consumption: { energy: 3, water: 4 },
    }]

    const result = applyInputScarcity(buildings, [
      resource('energy', 1),
      resource('water', 10),
      resource('food', 0),
    ], 1)

    expect(result.buildings[0].inputThrottle).toBeCloseTo(1 / 3)
    expect(result.buildings[0].production.food).toBeCloseTo(2)
    expect(result.buildings[0].consumption.energy).toBeCloseTo(1)
    expect(result.buildings[0].consumption.water).toBeCloseTo(4 / 3)
  })

  it('uses building production as available input for other buildings', () => {
    const buildings: BuildingRateInput[] = [
      { buildingId: 'solar-1', buildingType: 'solar_panels', production: { energy: 15 }, consumption: {} },
      { buildingId: 'greenhouse-1', buildingType: 'greenhouse', production: { food: 6 }, consumption: { energy: 3 } },
    ]

    const result = applyInputScarcity(buildings, [
      resource('energy', 0),
      resource('food', 0),
    ], 1)

    expect(result.buildings.find(building => building.buildingId === 'solar-1')?.inputThrottle).toBe(1)
    expect(result.buildings.find(building => building.buildingId === 'greenhouse-1')?.inputThrottle).toBe(1)
  })

  it('keeps no-input buildings at full output under scarcity', () => {
    const buildings: BuildingRateInput[] = [
      { buildingId: 'solar-1', buildingType: 'solar_panels', production: { energy: 15 }, consumption: {} },
    ]

    const result = applyInputScarcity(buildings, [], 1)

    expect(result.buildings[0].inputThrottle).toBe(1)
    expect(result.buildings[0].production.energy).toBe(15)
  })
})
