import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { recordAttackTrigger } from '@/domains/combat/combat.triggers'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

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

describe('trigger field payloads', () => {
  it('creates a finite team barrier after an attack-count trigger', () => {
    const owner = makeUnit({
      id: 'accumulator',
      team: 'attacker',
      triggerEffects: [{
        id: 'accumulator-shield',
        event: 'attack_count',
        count: 2,
        payload: { kind: 'field', target: 'self', field: { id: 'accumulator-dome', kind: 'barrier_dome', radius: 80, intervalTicks: 99, duration: 20, capacity: 30 } },
        fired: false,
        counter: 0,
        cooldownRemaining: 0,
      }],
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 40 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []
    const context = { units: [owner, target], hazards, actions, rng: new PRNG(1), tick: 7 }

    recordAttackTrigger(owner, target, context)
    expect(hazards).toHaveLength(0)
    recordAttackTrigger(owner, target, context)

    expect(hazards[0]).toMatchObject({ type: 'barrier_dome', team: 'attacker', x: 0, y: 0, radius: 80, capacity: 30, duration: 20 })
    expect(actions).toContainEqual({ unitId: 'accumulator', type: 'barrier_spawn', hazardId: hazards[0].id, radius: 80, damage: 30 })

    const enemy = makeUnit({ id: 'enemy', team: 'defender', attack: 50 })
    const result = applyCombatDamage(enemy, owner, enemy.attack, actions, { hazards })

    expect(result.damage).toBe(20)
    expect(hazards[0].capacity).toBe(0)
    expect(actions).toContainEqual({ unitId: 'accumulator', type: 'barrier_break', hazardId: hazards[0].id })
  })
})
