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

describe('shield hit block primitive', () => {
  it('fully blocks the first shield overflow hit and then falls back to numeric shield rules', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 80 })
    const target = makeUnit({ id: 'shielded', team: 'defender', shield: 20, maxShield: 20, shieldHitBlock: { charges: 1 }, shieldHitBlockCharges: 1 })
    const actions: BattleAction[] = []

    const first = applyCombatDamage(attacker, target, attacker.attack, actions)

    expect(first).toMatchObject({ damage: 0, shieldDamage: 20, shieldBroken: true, shieldHitBlock: true, shieldHitBlockedDamage: 60 })
    expect(target.hp).toBe(100)
    expect(target.shieldHitBlockCharges).toBe(0)
    expect(actions).toEqual([
      { unitId: 'shielded', type: 'unit_blocked_damage', targetId: 'attacker', damage: 60 },
      { unitId: 'shielded', type: 'shield_hit_block', targetId: 'attacker', damage: 60 },
      { unitId: 'attacker', type: 'shield_damage', targetId: 'shielded', damage: 20, isShieldHit: true },
      { unitId: 'attacker', type: 'shield_break', targetId: 'shielded' },
    ])

    target.shield = 20
    target.maxShield = 20
    actions.length = 0
    const second = applyCombatDamage(attacker, target, attacker.attack, actions)

    expect(second).toMatchObject({ damage: 60, shieldDamage: 20, shieldBroken: true, shieldHitBlock: false })
    expect(target.hp).toBe(40)
    expect(actions.some(action => action.type === 'shield_hit_block')).toBe(false)
  })
})
