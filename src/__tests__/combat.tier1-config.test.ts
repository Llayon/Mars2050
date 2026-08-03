import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import {
  getTier1CommandCost,
  TIER1_COMMAND_COSTS,
  TIER1_COMMAND_RULES,
  TIER1_UNIT_TYPES,
} from '@/domains/combat/combat.tier1.config'

describe('Tier 1 simulator balance config', () => {
  it('defines twelve unique Tier 1 squads at one command point each', () => {
    expect(TIER1_UNIT_TYPES).toHaveLength(12)
    expect(new Set(TIER1_UNIT_TYPES).size).toBe(12)
    expect(Object.values(TIER1_COMMAND_COSTS)).toEqual(Array.from({ length: 12 }, () => 1))
    expect(TIER1_UNIT_TYPES.every(unitType => UNIT_TYPES[unitType] !== undefined)).toBe(true)
  })

  it('keeps the adjustable shared command limit contract', () => {
    expect(TIER1_COMMAND_RULES).toEqual({ minLimit: 3, maxLimit: 12, defaultLimit: 6 })
    expect(getTier1CommandCost('marine')).toBe(1)
    expect(getTier1CommandCost('exosuit')).toBeNull()
  })

  it('keeps role-specific squad silhouettes for the reworked line units', () => {
    expect(UNIT_TYPES.flamethrower).toMatchObject({ squadSize: 5, formation: 'wedge' })
    expect(UNIT_TYPES.grenadier).toMatchObject({ squadSize: 3, formation: 'line' })
    expect(UNIT_TYPES.heavy_gunner).toMatchObject({ squadSize: 3, formation: 'line' })
    expect(UNIT_TYPES.explosive_drone).toMatchObject({ squadSize: 4, formation: 'wedge' })
    expect(UNIT_TYPES.light_walker).toMatchObject({ squadSize: 1 })

    for (const unitType of TIER1_UNIT_TYPES) {
      const config = UNIT_TYPES[unitType]
      if ((config.squadSize ?? 1) > 1) expect(config.formation, unitType).toBeTruthy()
    }
  })

  it('keeps retired specialists out of recruitment without breaking replay config', () => {
    expect(UNIT_TYPES.sapper.recruitable).toBe(false)
    expect(UNIT_TYPES.officer.recruitable).toBe(false)
    expect(TIER1_UNIT_TYPES).not.toContain('sapper')
    expect(TIER1_UNIT_TYPES).not.toContain('officer')
  })
})
