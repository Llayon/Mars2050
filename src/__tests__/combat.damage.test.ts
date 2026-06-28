import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { applyStatus } from '@/domains/combat/combat.status'
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

describe('combat.damage', () => {
  it('keeps current shield behavior where a broken shield absorbs the full hit', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 50 })
    const target = makeUnit({ id: 'target', team: 'defender', shield: 10, maxShield: 10 })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result).toEqual({ damage: 0, isShieldHit: true })
    expect(target.hp).toBe(100)
    expect(target.shield).toBe(0)
  })

  it('does not turn zero-attack utility effects into hidden chip damage', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 0 })
    const target = makeUnit({ id: 'target', team: 'defender' })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result).toEqual({ damage: 0, isShieldHit: false })
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
})
