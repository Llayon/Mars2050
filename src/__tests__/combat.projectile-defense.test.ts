import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
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

describe('combat projectile defense', () => {
  it('intercepts eligible projectile damage before mitigation and shield damage', () => {
    const attacker = makeUnit({ id: 'rocket', team: 'attacker', x: 0, y: 0, attack: 50 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 120, y: 0, shield: 30, maxShield: 30 })
    const emitter = makeUnit({
      id: 'emitter',
      team: 'defender',
      x: 100,
      y: 0,
      projectileInterceptRadius: 180,
      projectileInterceptCooldownMax: 12,
      projectileInterceptCooldown: 0,
    })
    const actions: BattleAction[] = []

    const result = applyCombatDamage(attacker, target, attacker.attack, actions, {
      units: [attacker, target, emitter],
      interceptable: true,
    })

    expect(result).toMatchObject({ intercepted: true, damage: 0, shieldDamage: 0, blockedDamage: 50 })
    expect(target.hp).toBe(100)
    expect(target.shield).toBe(30)
    expect(emitter.projectileInterceptCooldown).toBe(12)
    expect(actions).toEqual([{
      unitId: 'emitter',
      type: 'projectile_intercept',
      targetId: 'target',
      damage: 50,
      fromX: 0,
      fromY: 0,
      toX: 120,
      toY: 0,
    }])
  })

  it('does not intercept non-projectile damage', () => {
    const attacker = makeUnit({ id: 'beam', team: 'attacker', attack: 50 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 120, y: 0 })
    const emitter = makeUnit({
      id: 'emitter',
      team: 'defender',
      x: 100,
      y: 0,
      projectileInterceptRadius: 180,
      projectileInterceptCooldownMax: 12,
      projectileInterceptCooldown: 0,
    })
    const actions: BattleAction[] = []

    const result = applyCombatDamage(attacker, target, attacker.attack, actions, {
      units: [attacker, target, emitter],
      interceptable: false,
    })

    expect(result.intercepted).toBe(false)
    expect(target.hp).toBe(50)
    expect(emitter.projectileInterceptCooldown).toBe(0)
    expect(actions).toEqual([{ unitId: 'beam', type: 'damage', targetId: 'target', damage: 50 }])
  })

  it('blocks long-range explosive attacks through actionSystem', () => {
    const attacker = makeUnit({
      id: 'buggy',
      team: 'attacker',
      type: 'missile_buggy',
      attack: 50,
      range: 400,
      actionCooldownMax: 15,
      x: 0,
      y: 0,
      currentAngle: 0,
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 120, y: 0 })
    const emitter = makeUnit({
      id: 'emitter',
      team: 'defender',
      type: 'shield_emitter',
      x: 110,
      y: 0,
      projectileInterceptRadius: 180,
      projectileInterceptCooldownMax: 12,
      projectileInterceptCooldown: 0,
    })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    const acted = actionSystem(attacker, target, [attacker, target, emitter], hazards, actions, new PRNG(1))

    expect(acted).toBe(true)
    expect(target.hp).toBe(100)
    expect(attacker.actionCooldown).toBe(15)
    expect(actions).toEqual([
      { unitId: 'buggy', type: 'attack', targetId: 'target' },
      { unitId: 'emitter', type: 'projectile_intercept', targetId: 'target', damage: 50, fromX: 0, fromY: 0, toX: 120, toY: 0 },
    ])
  })
})
