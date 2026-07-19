import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import {
  applyStatus,
  cleanseStatuses,
  getActionCooldownRecovery,
  getEffectiveActionRange,
  getMovementSpeedMultiplier,
  getStatusValue,
  hasStatus,
  tickStatuses,
} from '@/domains/combat/combat.status'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { resolveUnitDeath } from '@/domains/combat/combat.death'

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

describe('combat.status', () => {
  it('applies and refreshes statuses by deterministic stack identity', () => {
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []

    expect(applyStatus(target, { type: 'vulnerable', duration: 5, value: 0.2, sourceUnitId: 'ion' }, actions)).toBe(true)
    expect(applyStatus(target, { type: 'vulnerable', duration: 3, value: 0.4, sourceUnitId: 'ion' }, actions)).toBe(false)

    expect(target.statusEffects).toHaveLength(1)
    expect(target.statusEffects[0]).toMatchObject({ type: 'vulnerable', duration: 5, value: 0.4 })
    expect(actions.map(action => action.type)).toEqual(['status_apply', 'status_apply'])
  })

  it('keeps the strongest slow value when multipliers are below one', () => {
    const target = makeUnit({ id: 'target', team: 'defender' })

    applyStatus(target, { type: 'slow', duration: 5, value: 0.7, sourceUnitId: 'cryo' })
    applyStatus(target, { type: 'slow', duration: 5, value: 0.4, sourceUnitId: 'cryo' })

    expect(getStatusValue(target, 'slow')).toBe(0.4)
    expect(getMovementSpeedMultiplier(target)).toBe(0.4)
  })

  it('computes effective action range from range suppression', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', range: 200 })

    applyStatus(attacker, { type: 'range_suppressed', duration: 5, value: 0.25, sourceUnitId: 'sonic' })

    expect(getEffectiveActionRange(attacker)).toBe(150)
  })

  it('computes effective action range from range boost and suppression', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', range: 200 })

    applyStatus(attacker, { type: 'range_boost', duration: 5, value: 0.5, sourceUnitId: 'radar' })
    applyStatus(attacker, { type: 'range_suppressed', duration: 5, value: 0.25, sourceUnitId: 'sonic' })

    expect(getEffectiveActionRange(attacker)).toBe(225)
  })

  it('uses only the strongest haste value for action cooldown recovery', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker' })
    applyStatus(attacker, { type: 'haste', duration: 5, value: 0.12, sourceUnitId: 'officer-a' })
    applyStatus(attacker, { type: 'haste', duration: 5, value: 0.18, sourceUnitId: 'officer-b' })

    expect(getActionCooldownRecovery(attacker)).toBe(1.18)
  })

  it('ticks statuses and emits deterministic expire actions', () => {
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []
    applyStatus(target, { type: 'emp', duration: 1, sourceUnitId: 'drone' })

    tickStatuses(target, actions)

    expect(hasStatus(target, 'emp')).toBe(false)
    expect(actions).toEqual([{ unitId: 'target', type: 'status_expire', statusType: 'emp' }])
  })

  it('applies periodic status damage deterministically', () => {
    const target = makeUnit({ id: 'target', team: 'defender', hp: 2 })
    const source = makeUnit({ id: 'flame', team: 'attacker' })
    const actions: BattleAction[] = []
    applyStatus(target, { type: 'burn', duration: 11, value: 3, sourceUnitId: 'flame' })

    for (let tick = 0; tick < 10; tick++) {
      tickStatuses(target, actions, {
        onUnitDeath: (dead, _sourceId, cause) => resolveUnitDeath(dead, source, cause, { units: [source, target], hazards: [], actions, rng: new PRNG(1) }),
      })
    }

    expect(target.isDead).toBe(true)
    expect(actions).toEqual([
      { unitId: 'flame', type: 'status_tick', targetId: 'target', statusType: 'burn', value: 3 },
      { unitId: 'flame', type: 'damage', targetId: 'target', damage: 3, statusType: 'burn', damageKind: 'dot' },
      { unitId: 'target', type: 'die', sourceUnitId: 'flame', cause: 'burn' },
    ])
  })

  it('ticks a duration-30 periodic status exactly three times', () => {
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []
    applyStatus(target, { type: 'burn', duration: 30, value: 3, sourceUnitId: 'flame' })

    for (let tick = 0; tick < 30; tick++) tickStatuses(target, actions)

    expect(target.hp).toBe(91)
    expect(actions.filter(action => action.type === 'status_tick')).toHaveLength(3)
  })

  it('cleanses only selected status types', () => {
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []
    applyStatus(target, { type: 'burn', duration: 5 })
    applyStatus(target, { type: 'emp', duration: 5 })

    const removed = cleanseStatuses(target, ['burn'], actions)

    expect(removed).toBe(1)
    expect(hasStatus(target, 'burn')).toBe(false)
    expect(hasStatus(target, 'emp')).toBe(true)
    expect(actions).toEqual([{ unitId: 'target', type: 'status_cleanse', statusType: 'burn' }])
  })

  it('blocks harmful status applications while status immunity is active', () => {
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []
    applyStatus(target, { type: 'status_immunity', duration: 5, sourceUnitId: 'engineer' })

    const applied = applyStatus(target, { type: 'burn', duration: 5, sourceUnitId: 'flame' }, actions)

    expect(applied).toBe(false)
    expect(hasStatus(target, 'burn')).toBe(false)
    expect(actions).toEqual([{ unitId: 'target', type: 'status_immune', statusType: 'burn' }])
  })

  it('blocks attacks while EMP is active', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker' })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []
    applyStatus(attacker, { type: 'emp', duration: 5 })

    const acted = actionSystem(attacker, target, [attacker, target], hazards, actions, new PRNG(1))

    expect(acted).toBe(false)
    expect(actions).toEqual([])
    expect(target.hp).toBe(100)
  })

  it('blocks attacks while hacked is active', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker' })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []
    applyStatus(attacker, { type: 'hacked', duration: 5 })

    const acted = actionSystem(attacker, target, [attacker, target], hazards, actions, new PRNG(1))

    expect(acted).toBe(false)
    expect(actions).toEqual([])
    expect(target.hp).toBe(100)
  })

  it('emits control mode when applying hacked control statuses', () => {
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []

    applyStatus(target, { type: 'hacked', duration: 5, controlMode: 'redirect' }, actions)

    expect(actions).toEqual([{ unitId: 'target', type: 'status_apply', statusType: 'hacked', value: undefined, controlMode: 'redirect' }])
  })

  it('uses range suppression for attack range checks', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', range: 100 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []
    applyStatus(attacker, { type: 'range_suppressed', duration: 5, value: 0.5 })

    const acted = actionSystem(attacker, target, [attacker, target], hazards, actions, new PRNG(1))

    expect(acted).toBe(false)
    expect(actions).toEqual([])
    expect(target.hp).toBe(100)
  })

  it('applies configured on-hit statuses without requiring damage', () => {
    const attacker = makeUnit({
      id: 'attacker',
      team: 'attacker',
      attack: 0,
      statusOnHit: [{ type: 'emp', duration: 30 }]
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    const acted = actionSystem(attacker, target, [attacker, target], hazards, actions, new PRNG(1))

    expect(acted).toBe(true)
    expect(target.hp).toBe(100)
    expect(hasStatus(target, 'emp')).toBe(true)
    expect(actions).toContainEqual({ unitId: 'target', type: 'status_apply', statusType: 'emp', value: undefined })
  })
})
