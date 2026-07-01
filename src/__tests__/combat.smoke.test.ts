import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { processHazards } from '@/domains/combat/combat.hazards'
import { tryDeploySmoke } from '@/domains/combat/combat.smoke'
import { getEffectiveActionRange } from '@/domains/combat/combat.status'
import { actionSystem } from '@/domains/combat/combat.systems'
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

describe('combat smoke fields', () => {
  it('deploys deterministic smoke with suppression payloads', () => {
    const unit = makeUnit({
      id: 'smoker',
      team: 'attacker',
      smokeOnAction: { radius: 80, duration: 30, rangeSuppression: 0.5, outputSuppression: 0.25, accuracySuppression: 0.4 },
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 160, y: 0 })
    const hazards: SimHazard[] = []
    const actions: BattleAction[] = []

    expect(tryDeploySmoke(unit, target, hazards, actions, new PRNG(1))).toBe(true)

    expect(hazards[0]).toMatchObject({ team: 'attacker', type: 'smoke', radius: 80, duration: 30, damagePerTick: 0 })
    expect(hazards[0].statusEffects).toEqual([
      { type: 'range_suppressed', duration: 12, value: 0.5 },
      { type: 'output_suppressed', duration: 12, value: 0.25 },
      { type: 'accuracy_reduced', duration: 12, value: 0.4 },
    ])
    expect(actions[0]).toMatchObject({ unitId: 'smoker', type: 'hazard_spawn', statusType: 'smoke', radius: 80 })
  })

  it('applies smoke suppression to ground units in deterministic id order', () => {
    const smoke: SimHazard = {
      id: 'smoke-1',
      team: 'attacker',
      type: 'smoke',
      x: 100,
      y: 100,
      radius: 80,
      damagePerTick: 0,
      duration: 21,
      statusEffects: [{ type: 'range_suppressed', duration: 12, value: 0.5 }],
    }
    const a = makeUnit({ id: 'a', team: 'attacker', x: 120, y: 100, range: 200 })
    const b = makeUnit({ id: 'b', team: 'defender', x: 130, y: 100, range: 200 })
    const flyer = makeUnit({ id: 'flyer', team: 'defender', x: 130, y: 100, range: 200, isFlying: true })
    const actions: BattleAction[] = []

    processHazards([smoke], [b, flyer, a], actions)

    expect(getEffectiveActionRange(a)).toBe(100)
    expect(getEffectiveActionRange(b)).toBe(100)
    expect(getEffectiveActionRange(flyer)).toBe(200)
    expect(actions.map(action => action.targetId ?? action.unitId)).toEqual(['a', 'b'])
    expect(actions.every(action => action.type === 'status_apply' && action.statusType === 'range_suppressed')).toBe(true)
  })

  it('uses actionSystem to deploy smoke instead of direct damage', () => {
    const unit = makeUnit({
      id: 'smoker',
      team: 'attacker',
      attack: 50,
      range: 200,
      smokeOnAction: { radius: 80, duration: 30, rangeSuppression: 0.5 },
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 160, y: 0 })
    const hazards: SimHazard[] = []
    const actions: BattleAction[] = []

    expect(actionSystem(unit, target, [unit, target], hazards, actions, new PRNG(2))).toBe(true)

    expect(target.hp).toBe(100)
    expect(unit.actionCooldown).toBe(10)
    expect(hazards[0]?.type).toBe('smoke')
    expect(actions.map(action => action.type)).toEqual(['hazard_spawn'])
  })

  it('turns smoke accuracy suppression into deterministic glancing damage', () => {
    const smoke: SimHazard = {
      id: 'smoke-accuracy',
      team: 'attacker',
      type: 'smoke',
      x: 0,
      y: 0,
      radius: 80,
      damagePerTick: 0,
      duration: 21,
      statusEffects: [{ type: 'accuracy_reduced', duration: 12, value: 0.4 }],
    }
    const shooter = makeUnit({ id: 'shooter', team: 'attacker', attack: 50 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 160 })

    processHazards([smoke], [shooter, target], [])
    const result = applyCombatDamage(shooter, target, shooter.attack)

    expect(result.damage).toBe(30)
    expect(target.hp).toBe(70)
  })
})
