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

  it('uses one compact internal formation for every multi-model Tier 1 squad', () => {
    for (const unitType of TIER1_UNIT_TYPES) {
      const config = UNIT_TYPES[unitType]
      if ((config.squadSize ?? 1) > 1) expect(config.formation, unitType).toBe('grid')
    }
  })
})
