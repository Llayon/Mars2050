import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { applyTargetMark, tickTargetMark } from '@/domains/combat/combat.mark'
import type { SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 10,
    range: 120,
    attackType: 'single',
    actionCooldownMax: 10,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    x: 0,
    y: 0,
    isDead: false,
    turnSpeed: 10,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    ...overrides,
  }
}

describe('combat.mark', () => {
  it('applies and expires source-specific target marks', () => {
    const attacker = makeUnit({ id: 'hunter', team: 'attacker', markOnHit: { duration: 1, damageMultiplier: 0.25 } })
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []

    expect(applyTargetMark(attacker, target, actions)).toBe(true)
    expect(target.targetMark).toMatchObject({ sourceUnitId: 'hunter', duration: 1, damageMultiplier: 0.25 })
    expect(actions).toEqual([{ unitId: 'hunter', type: 'target_mark', targetId: 'target', value: 0.25 }])

    tickTargetMark(target, actions)

    expect(target.targetMark).toBeUndefined()
    expect(actions[1]).toEqual({ unitId: 'hunter', type: 'target_mark_expire', targetId: 'target' })
  })

  it('boosts damage only for the mark source', () => {
    const hunter = makeUnit({ id: 'hunter', team: 'attacker' })
    const other = makeUnit({ id: 'other', team: 'attacker' })
    const target = makeUnit({ id: 'target', team: 'defender', hp: 200, targetMark: { sourceUnitId: 'hunter', duration: 5, damageMultiplier: 0.5 } })

    expect(applyCombatDamage(other, target, 40).damage).toBe(40)
    expect(applyCombatDamage(hunter, target, 40).damage).toBe(60)
  })

  it('executes marked targets below the source threshold', () => {
    const hunter = makeUnit({ id: 'hunter', team: 'attacker' })
    const target = makeUnit({ id: 'target', team: 'defender', hp: 90, targetMark: { sourceUnitId: 'hunter', duration: 5, executeThreshold: 100 } })

    const result = applyCombatDamage(hunter, target, 10)

    expect(result.damage).toBe(90)
    expect(target.hp).toBe(0)
  })
})
