import { describe, expect, it } from 'vitest'
import { compileAbilityDefinitions } from '@/domains/combat/combat.ability-compiler'
import { barrageAbility } from '@/domains/combat/combat.ability-config'
import { compileTemporalWeaponPlan } from '@/domains/combat/combat.temporal-compiler'
import type { UnitBaseStats } from '@/domains/combat/combat.types'

function stats(overrides: Partial<UnitBaseStats> = {}): UnitBaseStats {
  return {
    hp: 100,
    attack: 20,
    defense: 2,
    speed: 5,
    range: 5,
    attackType: 'single',
    ...overrides,
  }
}

describe('compiled temporal weapon plans', () => {
  it('normalizes authored barrage offsets and defaults once', () => {
    const programs = compileAbilityDefinitions([
      barrageAbility('artillery', {
        impacts: 4,
        radius: 70,
        spreadRadius: 110,
        damageMultiplier: 0.45,
      }),
    ])
    const plan = compileTemporalWeaponPlan('artillery', stats({
      delivery: { kind: 'ground_targeted', flightTicks: 12, windupTicks: 8, interceptable: true },
      abilities: [],
    }), programs)

    expect(plan?.barrage).toMatchObject({
      impacts: 4,
      radius: 70,
      damageMultiplier: 0.45,
      maxTargets: 6,
      impactIntervalTicks: 1,
    })
    expect(plan?.barrage?.offsets).toHaveLength(4)
  })

  it('rejects a ground delivery without exactly one barrage plan', () => {
    const delivery = { kind: 'ground_targeted' as const, flightTicks: 12, windupTicks: 8, interceptable: true }
    expect(() => compileTemporalWeaponPlan('missing', stats({ delivery }), [])).toThrow(/exactly one barrage/)

    const programs = compileAbilityDefinitions([
      barrageAbility('first', { impacts: 1, radius: 10, spreadRadius: 0, damageMultiplier: 1 }),
      barrageAbility('second', { impacts: 1, radius: 10, spreadRadius: 0, damageMultiplier: 1 }),
    ])
    expect(() => compileTemporalWeaponPlan('duplicate', stats({ delivery }), programs)).toThrow(/exactly one barrage/)
  })

  it('rejects impact programs that cannot execute for the delivery', () => {
    const impactPrograms = compileAbilityDefinitions([{
      id: 'impact',
      trigger: { kind: 'projectile_impact' },
      effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'apply_status', status: 'burn', duration: 2 }] }],
    }])
    expect(() => compileTemporalWeaponPlan('instant', stats({ delivery: undefined }), impactPrograms))
      .toThrow(/instant delivery/)
    expect(() => compileTemporalWeaponPlan('ground', stats({
      delivery: { kind: 'ground_targeted', flightTicks: 2, windupTicks: 1, interceptable: true },
      barrageAttack: { impacts: 1, radius: 10, spreadRadius: 0, damageMultiplier: 1 },
    }), impactPrograms)).toThrow(/area_at_impact/)
  })
})
