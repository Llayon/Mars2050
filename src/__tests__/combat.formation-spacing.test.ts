import { describe, expect, it } from 'vitest'
import { getFormationSpacing } from '@/domains/combat/combat.runtime-primitives'
import type { UnitBaseStats } from '@/domains/combat/combat.types'

const baseStats: UnitBaseStats = {
  hp: 100,
  attack: 10,
  defense: 0,
  speed: 10,
  range: 3,
  attackType: 'single',
}

describe('combat formation spacing', () => {
  it('applies the configured formation spacing multiplier', () => {
    expect(getFormationSpacing(20, {
      ...baseStats,
      formationModifiers: { spacingMultiplier: 1.5 },
    })).toBe(30)
  })
})
