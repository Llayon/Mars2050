import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { applyStatus } from '@/domains/combat/combat.status'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

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

describe('combat.damage', () => {
  it('lets overflow damage pass through a broken shield', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50 })
    const target = makeUnit({ id: 'target', team: 'defender', shield: 10, maxShield: 10 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result).toMatchObject({ damage: 40, isShieldHit: true, shieldDamage: 10, shieldBroken: true })
    expect(target.hp).toBe(60)
    expect(target.shield).toBe(0)
  })

  it('does not turn zero-attack utility effects into hidden chip damage', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 0 })
    const target = makeUnit({ id: 'target', team: 'defender' })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result).toMatchObject({ damage: 0, isShieldHit: false, shieldDamage: 0 })
    expect(target.hp).toBe(100)
  })

  it('applies vulnerable and damage reduction through one damage pipeline', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50 })
    const target = makeUnit({ id: 'target', team: 'defender' })
    applyStatus(target, { type: 'vulnerable', duration: 5, value: 0.5 })
    applyStatus(target, { type: 'damage_reduction', duration: 5, value: 0.2 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(60)
    expect(target.hp).toBe(40)
  })

  it('applies armor broken before defense', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50 })
    const target = makeUnit({ id: 'target', team: 'defender', defense: 20 })
    applyStatus(target, { type: 'armor_broken', duration: 5, value: 0.5 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(40)
    expect(target.hp).toBe(60)
  })

  it('reduces attacker damage while output suppressed', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50 })
    const target = makeUnit({ id: 'target', team: 'defender' })
    applyStatus(attacker, { type: 'output_suppressed', duration: 5, value: 0.4 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(30)
    expect(target.hp).toBe(70)
  })

  it('emits detailed replay actions for mitigated, shielded, and lifesteal damage', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50, hp: 50, lifestealMult: 0.5 })
    const target = makeUnit({ id: 'target', team: 'defender', defense: 10, shield: 15, maxShield: 15 })
    const actions: BattleAction[] = []

    const result = applyCombatDamage(attacker, target, attacker.attack, actions)

    expect(result).toMatchObject({ damage: 25, shieldDamage: 15, shieldBroken: true, blockedDamage: 10, lifesteal: 12 })
    expect(target.hp).toBe(75)
    expect(attacker.hp).toBe(62)
    expect(actions).toEqual([
      { unitId: 'target', type: 'unit_blocked_damage', targetId: 'attacker', damage: 10 },
      { unitId: 'attacker', type: 'shield_damage', targetId: 'target', damage: 15, isShieldHit: true },
      { unitId: 'attacker', type: 'shield_break', targetId: 'target' },
      { unitId: 'attacker', type: 'damage', targetId: 'target', damage: 25 },
      { unitId: 'attacker', type: 'lifesteal', targetId: 'attacker', damage: 12 },
    ])
  })

  it('keeps attack actions as animation intent while damage actions carry HP loss', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 30 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    const acted = actionSystem(attacker, target, [attacker, target], hazards, actions, new PRNG(1))

    expect(acted).toBe(true)
    expect(target.hp).toBe(70)
    expect(actions[0]).toEqual({ unitId: 'attacker', type: 'attack', targetId: 'target' })
    expect(actions[1]).toEqual({ unitId: 'attacker', type: 'damage', targetId: 'target', damage: 30 })
    expect(actions[0].damage).toBeUndefined()
  })
})
