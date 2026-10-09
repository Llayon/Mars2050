import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { assertValidWeaponLoadout, getAreaGeometries } from '@/domains/combat/combat.weapon-validation'
import type { UnitBaseStats } from '@/domains/combat/combat.types'

describe('combat weapon loadout validation', () => {
  it('accepts every configured base unit', () => {
    for (const [unitType, config] of Object.entries(UNIT_TYPES)) {
      expect(() => assertValidWeaponLoadout(unitType, config.baseStats as unknown as Parameters<typeof assertValidWeaponLoadout>[1])).not.toThrow()
    }
  })

  it('allows secondary weapons beside one area geometry', () => {
    const stats: UnitBaseStats = {
      ...UNIT_TYPES.flamethrower.baseStats,
      splitFire: { maxTargets: 2, damageMultiplier: 0.5 },
      sideWeapon: { damage: 4, range: 2, maxTargets: 1 },
    }

    expect(getAreaGeometries(stats as unknown as Parameters<typeof getAreaGeometries>[0])).toEqual(['cone'])
    expect(() => assertValidWeaponLoadout('valid', stats as unknown as Parameters<typeof assertValidWeaponLoadout>[1])).not.toThrow()
  })

  it('rejects multiple area geometries before simulation', () => {
    const stats: UnitBaseStats = {
      ...UNIT_TYPES.flamethrower.baseStats,
      chainAttack: { jumps: 2, radius: 80, damageMultiplier: 0.5 },
    }

    expect(() => assertValidWeaponLoadout('invalid', stats as unknown as Parameters<typeof assertValidWeaponLoadout>[1])).toThrow(/cone, chain/)
  })
})

