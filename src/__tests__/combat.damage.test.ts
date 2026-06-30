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

  it('adds capped percent HP bonus before mitigation for anti-giant weapons', () => {
    const attacker = makeUnit({ id: 'rail', team: 'attacker', type: 'railgun_walker', attack: 100 })
    const target = makeUnit({ id: 'giant', team: 'defender', hp: 1000, maxHp: 1000 })
    const actions: BattleAction[] = []

    const result = applyCombatDamage(attacker, target, attacker.attack, actions)

    expect(result.damage).toBe(160)
    expect(target.hp).toBe(840)
    expect(actions[0]).toEqual({ unitId: 'rail', type: 'percent_hp_damage', targetId: 'giant', value: 60 })
    expect(actions[1]).toEqual({ unitId: 'rail', type: 'damage', targetId: 'giant', damage: 160 })
  })

  it('caps percent HP bonus on very large targets', () => {
    const attacker = makeUnit({ id: 'rail', team: 'attacker', type: 'railgun_walker', attack: 100 })
    const target = makeUnit({ id: 'fortress', team: 'defender', hp: 3000, maxHp: 3000 })
    const actions: BattleAction[] = []

    const result = applyCombatDamage(attacker, target, attacker.attack, actions)

    expect(result.damage).toBe(190)
    expect(target.hp).toBe(2810)
    expect(actions[0]).toEqual({ unitId: 'rail', type: 'percent_hp_damage', targetId: 'fortress', value: 90 })
  })

  it('does not emit percent HP action for units without percent HP config', () => {
    const attacker = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', attack: 100 })
    const target = makeUnit({ id: 'target', team: 'defender', hp: 1000, maxHp: 1000 })
    const actions: BattleAction[] = []

    const result = applyCombatDamage(attacker, target, attacker.attack, actions)

    expect(result.damage).toBe(100)
    expect(actions).toEqual([{ unitId: 'marine', type: 'damage', targetId: 'target', damage: 100 }])
  })

  it('can disable percent HP bonus for secondary weapon hits', () => {
    const attacker = makeUnit({ id: 'rail', team: 'attacker', type: 'railgun_walker', attack: 100 })
    const target = makeUnit({ id: 'secondary', team: 'defender', hp: 1000, maxHp: 1000 })
    const actions: BattleAction[] = []

    const result = applyCombatDamage(attacker, target, attacker.attack, actions, { allowPercentHpDamage: false })

    expect(result.damage).toBe(100)
    expect(target.hp).toBe(900)
    expect(actions).toEqual([{ unitId: 'rail', type: 'damage', targetId: 'secondary', damage: 100 }])
  })

  it('spends reactive armor charges only after shield overflow reaches HP', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50 })
    const target = makeUnit({
      id: 'target',
      team: 'defender',
      shield: 15,
      maxShield: 15,
      reactiveArmorCharges: 1,
      reactiveArmorBlock: 30,
    })
    const actions: BattleAction[] = []

    const result = applyCombatDamage(attacker, target, attacker.attack, actions)

    expect(result).toMatchObject({ damage: 5, shieldDamage: 15, shieldBroken: true, blockedDamage: 30 })
    expect(target.hp).toBe(95)
    expect(target.shield).toBe(0)
    expect(target.reactiveArmorCharges).toBe(0)
    expect(actions).toEqual([
      { unitId: 'target', type: 'unit_blocked_damage', targetId: 'attacker', damage: 30 },
      { unitId: 'attacker', type: 'shield_damage', targetId: 'target', damage: 15, isShieldHit: true },
      { unitId: 'attacker', type: 'shield_break', targetId: 'target' },
      { unitId: 'attacker', type: 'damage', targetId: 'target', damage: 5 },
    ])
  })

  it('shares final HP damage across nearby allies deterministically', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 80 })
    const target = makeUnit({ id: 'target', team: 'defender', damageShareRadius: 120, damageShareRatio: 0.25, damageShareMaxTargets: 2 })
    const allyB = makeUnit({ id: 'ally-b', team: 'defender', x: 40, y: 0 })
    const allyA = makeUnit({ id: 'ally-a', team: 'defender', x: 30, y: 0 })
    const farAlly = makeUnit({ id: 'ally-far', team: 'defender', x: 200, y: 0 })
    const actions: BattleAction[] = []

    const result = applyCombatDamage(attacker, target, attacker.attack, actions, { units: [attacker, target, allyB, allyA, farAlly] })

    expect(result).toMatchObject({ damage: 60, sharedDamage: 20 })
    expect(target.hp).toBe(40)
    expect(allyA.hp).toBe(90)
    expect(allyB.hp).toBe(90)
    expect(farAlly.hp).toBe(100)
    expect(actions).toEqual([
      { unitId: 'attacker', type: 'damage', targetId: 'target', damage: 60 },
      { unitId: 'attacker', type: 'damage_share', targetId: 'ally-a', damage: 10 },
      { unitId: 'attacker', type: 'damage_share', targetId: 'ally-b', damage: 10 },
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
