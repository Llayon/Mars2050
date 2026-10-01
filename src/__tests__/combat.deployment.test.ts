import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { translateMarsBattleInput } from '@/domains/combat/combat.input-translator'
import { simulateCombat } from '@mars2050/combat-core'
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

  it('allows battle launch with frontline formation placement for single XL unit (titan_mech)', () => {
    const titan = unit(UUID_A, 'titan_mech')
    const placement = createFormationPlacement([titan], 'attack', 'frontline')
    expect(placement[UUID_A]).toEqual({ x: 30, y: 930 })

    const attacker: UnitRow = {
      ...titan,
      grid_x: String(placement[UUID_A].x),
      grid_y: String(placement[UUID_A].y),
    }
    const defender: UnitRow = {
      ...unit(UUID_B, 'marine'),
      grid_x: '300',
      grid_y: '200',
    }

    const result = simulateBattle([attacker], [defender], 42)
    expect(result.winner).toBe('attacker')
  })

  it('keeps single XL unit (titan_mech) strictly inside physical arena bounds when coordinates are omitted (seed 5)', () => {
    const titan = unit(UUID_A, 'titan_mech')
    const marine = unit(UUID_B, 'marine')
    const defender: UnitRow = {
      ...marine,
      grid_x: '300',
      grid_y: '200',
    }

    // 1. Without coordinates: titan spawns strictly within [45, 555] x [880, 1155]
    const input = translateMarsBattleInput([titan], [defender], 5)
    const result = simulateCombat(input)
    const titanEntity = result.initialState.find(u => u.id === UUID_A)
    expect(titanEntity).toBeDefined()
    expect(titanEntity!.x).toBeGreaterThanOrEqual(45)
    expect(titanEntity!.x).toBeLessThanOrEqual(555)
    expect(titanEntity!.y).toBeGreaterThanOrEqual(880)
    expect(titanEntity!.y).toBeLessThanOrEqual(1155)
    // Physical body (R=45) never extends beyond arena height 1200
    expect(titanEntity!.y + 45).toBeLessThanOrEqual(1200)

    // 2. Explicit coordinates (246, 1164) where body reaches Y=1209 > 1200 are rejected by validator
    input.units[0].placement = { x: 246, y: 1164 }
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES' }),
    )
  })
})
