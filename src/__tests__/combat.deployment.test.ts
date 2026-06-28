import { describe, expect, it } from 'vitest'
import {
  createFormationPlacement,
  findDeploymentOverlap,
  isInDeploymentZone,
  pointFromCell,
  serializeDeployment,
} from '@/domains/combat/combat.deployment'
import type { UnitRow } from '@/domains/combat/combat.types'

const UUID_A = '550e8400-e29b-41d4-a716-446655440000'
const UUID_B = '550e8400-e29b-41d4-a716-446655440001'

function unit(id: string, unitType: string): UnitRow {
  return {
    id,
    colony_id: 'c',
    unit_type: unitType,
    hp_current: 100,
    tier: 1,
    upgrade_path: [],
    grid_x: undefined,
    grid_y: undefined,
  } as UnitRow
}

describe('combat deployment helpers', () => {
  it('converts deployment cells to combat pixel centers', () => {
    expect(pointFromCell({ x: 0, y: 0 })).toEqual({ x: 30, y: 30 })
    expect(pointFromCell({ x: 9, y: 19 })).toEqual({ x: 570, y: 1170 })
  })

  it('separates defense and attack deployment zones', () => {
    expect(isInDeploymentZone('defense', 300, 240)).toBe(true)
    expect(isInDeploymentZone('defense', 300, 900)).toBe(false)
    expect(isInDeploymentZone('attack', 300, 900)).toBe(true)
    expect(isInDeploymentZone('attack', 300, 500)).toBe(false)
  })

  it('detects footprint overlap using squad size', () => {
    const marine = unit(UUID_A, 'marine')
    const shock = unit(UUID_B, 'shock_trooper')
    const placement = {
      [UUID_A]: { x: 300, y: 900 },
      [UUID_B]: { x: 310, y: 910 },
    }

    expect(findDeploymentOverlap(marine, placement[UUID_A], placement, [marine, shock])).toBe(shock)
  })

  it('creates attack formations inside the attack zone', () => {
    const units = [unit(UUID_A, 'shock_trooper'), unit(UUID_B, 'sniper')]
    const placement = createFormationPlacement(units, 'attack', 'frontline')

    expect(Object.values(placement).every(point => isInDeploymentZone('attack', point.x, point.y))).toBe(true)
    expect(serializeDeployment(placement)).toEqual([
      { unitId: UUID_A, x: 30, y: 750 },
      { unitId: UUID_B, x: 30, y: 1110 },
    ])
  })
})
