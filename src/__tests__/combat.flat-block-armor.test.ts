import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'marine',
    rank: 1,
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

describe('flat block armor primitive', () => {
  it('reduces every hit with rank scaling and emits blocked replay damage', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50 })
    const target = makeUnit({ id: 'armor', team: 'defender', rank: 3, flatDamageBlock: { amount: 8, perRank: 4 } })
    const actions: BattleAction[] = []

    const first = applyCombatDamage(attacker, target, attacker.attack, actions)
    const second = applyCombatDamage(attacker, target, attacker.attack, actions)

    expect(first.damage).toBe(34)
    expect(second.damage).toBe(34)
    expect(target.hp).toBe(32)
    expect(actions.filter(action => action.type === 'unit_blocked_damage')).toEqual([
      { unitId: 'armor', type: 'unit_blocked_damage', targetId: 'attacker', damage: 16 },
      { unitId: 'armor', type: 'unit_blocked_damage', targetId: 'attacker', damage: 16 },
    ])
  })

  it('respects minimum damage when flat block exceeds incoming damage', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 12 })
    const target = makeUnit({ id: 'armor', team: 'defender', flatDamageBlock: { amount: 50, minimumDamage: 3 } })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(3)
    expect(target.hp).toBe(97)
  })
})
