import { describe, it, expect } from 'vitest'
import { allocateBuildingStaffing } from '../domains/building/building.staffing'
import { getEffectiveProduction } from '../domains/building/building.production'
import type { BuildingRow } from '../domains/building/building.types'
import type { PopulationState } from '../domains/population/population.types'

describe('Building Staffing Allocation', () => {
  const mockPop: PopulationState = {
    id: 'pop-1',
    colony_id: 'col-1',
    workers: 5,
    technicians: 0,
    scientists: 0,
    directors: 0,
    happiness_workers: 50,
    happiness_technicians: 50,
    happiness_scientists: 50,
    happiness_directors: 50,
    growth_progress: 0,
    updated_at: '2024-01-01'
  }

  const baseBuilding: BuildingRow = {
    id: 'b1',
    colony_id: 'col-1',
    type: 'mine', // needs 2 workers
    name: 'Mine',
    level: 1,
    is_active: true,
    x: 0,
    y: 0,
    staffing_mode: 'auto',
    assigned_workers: 0,
    work_priority: 'normal',
    paused: false,
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  }

  it('allocates 0 to paused buildings', () => {
    const buildings = [
      { ...baseBuilding, id: 'b1', paused: true },
      { ...baseBuilding, id: 'b2', paused: true }
    ]
    const result = allocateBuildingStaffing(buildings, mockPop)
    expect(result['b1']).toBe(0)
    expect(result['b2']).toBe(0)
  })

  it('allocates 0 to inactive buildings', () => {
    const buildings = [
      { ...baseBuilding, id: 'b1', is_active: false, work_priority: 'high' as const },
      { ...baseBuilding, id: 'b2', work_priority: 'normal' as const }
    ]
    const result = allocateBuildingStaffing(buildings, mockPop)
    expect(result['b1']).toBe(0)
    expect(result['b2']).toBe(2)
  })

  it('handles manual assignments correctly within limits', () => {
    const buildings = [
      { ...baseBuilding, id: 'b1', staffing_mode: 'manual' as const, assigned_workers: 1 }, // takes 1
      { ...baseBuilding, id: 'b2', staffing_mode: 'manual' as const, assigned_workers: 3 }  // tries 3, max slots is 2, takes 2
    ]
    const result = allocateBuildingStaffing(buildings, mockPop) // 5 available
    expect(result['b1']).toBe(1)
    expect(result['b2']).toBe(2)
  })

  it('handles auto assignments by priority', () => {
    const buildings = [
      { ...baseBuilding, id: 'b1', work_priority: 'low' as const },
      { ...baseBuilding, id: 'b2', work_priority: 'normal' as const },
      { ...baseBuilding, id: 'b3', work_priority: 'high' as const }
    ]
    // 5 available. high needs 2 -> 3 left. normal needs 2 -> 1 left. low needs 2 -> gets 1.
    const result = allocateBuildingStaffing(buildings, mockPop)
    expect(result['b3']).toBe(2)
    expect(result['b2']).toBe(2)
    expect(result['b1']).toBe(1)
  })

  it('sorts auto assignments deterministically by ID when priority is equal', () => {
    const buildings = [
      { ...baseBuilding, id: 'Z_b2', work_priority: 'normal' as const }, // comes second alphabetically
      { ...baseBuilding, id: 'A_b1', work_priority: 'normal' as const }  // comes first alphabetically
    ]
    const pop = { ...mockPop, workers: 3 } // Only 3 workers available
    const result = allocateBuildingStaffing(buildings, pop)
    
    expect(result['A_b1']).toBe(2) // Gets full
    expect(result['Z_b2']).toBe(1) // Gets remaining
  })

  it('handles manual overriding auto', () => {
    const buildings = [
      { ...baseBuilding, id: 'b1', staffing_mode: 'manual' as const, assigned_workers: 2 },
      { ...baseBuilding, id: 'b2', staffing_mode: 'manual' as const, assigned_workers: 2 },
      { ...baseBuilding, id: 'b3', staffing_mode: 'auto' as const, work_priority: 'high' as const }
    ]
    // 5 available. manual b1 (2) + b2 (2) = 4 used. auto b3 gets remaining 1.
    const result = allocateBuildingStaffing(buildings, mockPop)
    expect(result['b1']).toBe(2)
    expect(result['b2']).toBe(2)
    expect(result['b3']).toBe(1)
  })

  it('does not auto-assign below minActiveSlots', () => {
    const pop = { ...mockPop, workers: 0, technicians: 1 }
    const buildings = [
      { ...baseBuilding, id: 'geo', type: 'geothermal_plant' as const }
    ]

    const result = allocateBuildingStaffing(buildings, pop)

    expect(result['geo']).toBe(0)
  })

  it('keeps paused and below-minimum buildings from producing or consuming', () => {
    const paused = { ...baseBuilding, assigned_workers: 2, paused: true }
    const belowMinimum = { ...baseBuilding, type: 'geothermal_plant' as const, assigned_workers: 1 }

    expect(getEffectiveProduction(paused, mockPop, [paused])).toEqual({ production: {}, consumption: {} })
    expect(getEffectiveProduction(belowMinimum, { ...mockPop, technicians: 1 }, [belowMinimum])).toEqual({
      production: { energy: 0 },
      consumption: {},
    })
  })
})
