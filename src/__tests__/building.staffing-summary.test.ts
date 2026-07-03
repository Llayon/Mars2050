import { describe, expect, it } from 'vitest'
import { buildStaffingManagementSummary } from '@/domains/building/building.staffing-summary'
import type { BuildingRow } from '@/domains/building/building.types'
import type { PopulationState } from '@/domains/population/population.types'

const population: PopulationState = {
  id: 'pop-1',
  colony_id: 'colony-1',
  workers: 5,
  technicians: 1,
  scientists: 0,
  directors: 0,
  happiness_workers: 80,
  happiness_technicians: 70,
  happiness_scientists: 50,
  happiness_directors: 50,
  growth_progress: 0,
  updated_at: '2026-01-01T00:00:00.000Z',
}

const baseBuilding: BuildingRow = {
  id: 'mine-1',
  colony_id: 'colony-1',
  type: 'mine',
  name: 'Mine',
  level: 1,
  is_active: true,
  x: 0,
  y: 0,
  staffing_mode: 'auto',
  assigned_workers: 0,
  work_priority: 'normal',
  paused: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('buildStaffingManagementSummary', () => {
  it('summarizes reserved, assigned, and free slots by tier', () => {
    const buildings: BuildingRow[] = [
      { ...baseBuilding, id: 'mine-1', work_priority: 'high' },
      { ...baseBuilding, id: 'mine-2', work_priority: 'normal' },
      { ...baseBuilding, id: 'mine-3', work_priority: 'low' },
    ]

    const summary = buildStaffingManagementSummary(buildings, population, { worker: 2 })
    const worker = summary.tiers.find(tier => tier.tier === 'worker')

    expect(worker).toEqual(expect.objectContaining({
      population: 5,
      reservedSlots: 2,
      assignedSlots: 3,
      requiredSlots: 6,
      freeSlots: 0,
    }))
    expect(summary.buildings.map(building => [building.id, building.assignedSlots])).toEqual([
      ['mine-1', 2],
      ['mine-2', 1],
      ['mine-3', 0],
    ])
  })

  it('marks paused, blocked, partial, and full building rows', () => {
    const buildings: BuildingRow[] = [
      { ...baseBuilding, id: 'paused', paused: true },
      { ...baseBuilding, id: 'blocked', type: 'geothermal_plant', name: 'Geo' },
      { ...baseBuilding, id: 'partial', staffing_mode: 'manual', assigned_workers: 1 },
      { ...baseBuilding, id: 'full', staffing_mode: 'manual', assigned_workers: 2 },
    ]

    const summary = buildStaffingManagementSummary(buildings, population)
    const statusById = Object.fromEntries(summary.buildings.map(building => [building.id, building.status]))

    expect(statusById).toEqual({
      paused: 'paused',
      blocked: 'blocked',
      partial: 'partial',
      full: 'full',
    })
  })
})
