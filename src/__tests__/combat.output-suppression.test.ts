import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { applyStatus } from '@/domains/combat/combat.status'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { BattleAction, SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
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

describe('combat.output-suppression', () => {
  it('stacks output suppression from separate sources with a cap', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 100 })
    const target = makeUnit({ id: 'target', team: 'defender' })

    applyStatus(attacker, { type: 'output_suppressed', duration: 5, value: 0.3, sourceUnitId: 'source-a' })
    applyStatus(attacker, { type: 'output_suppressed', duration: 5, value: 0.3, sourceUnitId: 'source-b' })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(50)
    expect(target.hp).toBe(50)
  })

  it('extends the next action cooldown when a suppressed unit acts', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    applyStatus(attacker, { type: 'output_suppressed', duration: 5, value: 0.5, sourceUnitId: 'source-a' })

    const acted = actionSystem(attacker, target, [attacker, target], hazards, actions, new PRNG(1))

    expect(acted).toBe(true)
    expect(attacker.actionCooldown).toBe(15)
    expect(target.hp).toBe(95)
  })
})
