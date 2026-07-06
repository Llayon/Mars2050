import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import {
  processHpThresholdTriggers,
  recordAttackTrigger,
  recordDamageTakenTrigger,
  tickTriggerCooldowns,
} from '@/domains/combat/combat.triggers'
import { hasStatus } from '@/domains/combat/combat.status'
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

function makeContext(units: SimUnit[], actions: BattleAction[], hazards: SimHazard[] = []) {
  return { units, hazards, actions, rng: new PRNG(1) }
}

describe('trigger effects', () => {
  it('fires HP-threshold emergency armor once unless repeatable', () => {
    const unit = makeUnit({
      id: 'tank',
      team: 'attacker',
      hp: 40,
      triggerEffects: [{ id: 'emergency-armor', event: 'hp_threshold', threshold: 0.5, payload: { kind: 'shield', target: 'self', amount: 30 }, fired: false, counter: 0, cooldownRemaining: 0 }],
    })
    const actions: BattleAction[] = []

    processHpThresholdTriggers(unit, makeContext([unit], actions))
    processHpThresholdTriggers(unit, makeContext([unit], actions))

    expect(unit.shield).toBe(30)
    expect(actions.filter(action => action.type === 'trigger_effect')).toHaveLength(1)
    expect(actions).toContainEqual({ unitId: 'tank', type: 'shield_apply', targetId: 'tank', damage: 30 })
  })

  it('fires attack-count triggers and resets repeatable counters', () => {
    const unit = makeUnit({
      id: 'gunner',
      team: 'attacker',
      actionCooldown: 8,
      triggerEffects: [{ id: 'compression-reset', event: 'attack_count', count: 2, repeatable: true, payload: { kind: 'cooldown_reset', target: 'self' }, fired: false, counter: 0, cooldownRemaining: 0 }],
    })
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []

    recordAttackTrigger(unit, target, makeContext([unit, target], actions))
    expect(unit.actionCooldown).toBe(8)
    recordAttackTrigger(unit, target, makeContext([unit, target], actions))

    expect(unit.actionCooldown).toBe(0)
    expect(unit.triggerEffects?.[0].counter).toBe(0)
    expect(actions).toContainEqual({ unitId: 'gunner', type: 'trigger_effect', targetId: 'gunner', statusType: 'compression-reset' })
  })

  it('fires damage-taken counter effects through the status pipeline', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'defender' })
    const target = makeUnit({
      id: 'target',
      team: 'attacker',
      triggerEffects: [{ id: 'counter-range', event: 'damage_taken', threshold: 5, payload: { kind: 'status', target: 'self', status: { type: 'range_boost', duration: 10, value: 0.5 } }, fired: false, counter: 0, cooldownRemaining: 1, cooldownTicks: 1, repeatable: true }],
    })
    const actions: BattleAction[] = []

    recordDamageTakenTrigger(attacker, target, 10, makeContext([attacker, target], actions))
    expect(hasStatus(target, 'range_boost')).toBe(false)
    tickTriggerCooldowns(target)
    recordDamageTakenTrigger(attacker, target, 10, makeContext([attacker, target], actions))

    expect(hasStatus(target, 'range_boost')).toBe(true)
    expect(actions).toContainEqual({ unitId: 'target', type: 'trigger_effect', targetId: 'target', statusType: 'counter-range' })
  })

  it('applies current-HP percent damage through trigger payloads', () => {
    const unit = makeUnit({
      id: 'disintegrator',
      team: 'attacker',
      hp: 40,
      triggerEffects: [{ id: 'disintegration', event: 'hp_threshold', threshold: 0.5, payload: { kind: 'damage', target: 'nearest_enemy', amount: 5, percentHp: { basis: 'current', percent: 0.25 } }, fired: false, counter: 0, cooldownRemaining: 0 }],
    })
    const target = makeUnit({ id: 'target', team: 'defender', hp: 80, maxHp: 200, x: 40 })
    const actions: BattleAction[] = []

    processHpThresholdTriggers(unit, makeContext([unit, target], actions))

    expect(target.hp).toBe(55)
    expect(actions).toContainEqual({ unitId: 'disintegrator', type: 'trigger_effect', targetId: 'target', statusType: 'disintegration' })
    expect(actions).toContainEqual({ unitId: 'disintegrator', type: 'percent_hp_damage', targetId: 'target', value: 20 })
  })
})
