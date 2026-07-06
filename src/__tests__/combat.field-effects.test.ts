import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { processFieldEffects } from '@/domains/combat/combat.field-effects'
import { processHazards } from '@/domains/combat/combat.hazards'
import { applyStatus, getEffectiveActionRange, hasStatus } from '@/domains/combat/combat.status'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; x: number; y: number }): SimUnit {
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
    isDead: false,
    turnSpeed: 1,
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

describe('field effects', () => {
  it('cleanses hazards and statuses as separate effects', () => {
    const engineer = makeUnit({
      id: 'engineer',
      team: 'attacker',
      x: 0,
      y: 0,
      fieldEffect: [{ id: 'extinguisher', kind: 'cleanse_field', radius: 120, intervalTicks: 10, nextTick: 0, hazardTypes: ['napalm', 'smoke'] }],
    })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 40, y: 0 })
    const hazards: SimHazard[] = [
      { id: 'fire', team: 'defender', type: 'napalm', x: 40, y: 0, radius: 60, damagePerTick: 2, duration: 20 },
      { id: 'acid', team: 'defender', type: 'acid', x: 40, y: 0, radius: 60, damagePerTick: 2, duration: 20 },
    ]
    const actions: BattleAction[] = []
    applyStatus(ally, { type: 'burn', duration: 20 })

    processFieldEffects(0, [engineer, ally], hazards, actions)

    expect(hazards.map(hazard => hazard.id)).toEqual(['acid'])
    expect(hasStatus(ally, 'burn')).toBe(false)
    expect(actions).toContainEqual({ unitId: 'engineer', type: 'hazard_cleanse', hazardId: 'fire', statusType: 'napalm' })
    expect(actions).toContainEqual({ unitId: 'ally', type: 'status_cleanse', statusType: 'burn' })
  })

  it('uses barrier domes as area protection distinct from temporary wall spawns', () => {
    const emitter = makeUnit({
      id: 'emitter',
      team: 'attacker',
      x: 0,
      y: 0,
      fieldEffect: [{ id: 'dome', kind: 'barrier_dome', radius: 100, intervalTicks: 10, nextTick: 0, duration: 10, value: 0.5 }],
    })
    const target = makeUnit({ id: 'target', team: 'attacker', x: 40, y: 0 })
    const attacker = makeUnit({ id: 'attacker', team: 'defender', x: 80, y: 0, attack: 100 })
    const hazards: SimHazard[] = []
    const actions: BattleAction[] = []

    processFieldEffects(0, [emitter, target, attacker], hazards, actions)
    const result = applyCombatDamage(attacker, target, 100, actions, { units: [emitter, target, attacker], hazards })

    expect(result.damage).toBe(50)
    expect(actions).toContainEqual({ unitId: 'target', type: 'barrier_absorb', targetId: 'attacker', damage: 50 })
    expect(hazards[0]).toMatchObject({ type: 'barrier_dome', damageReduction: 0.5 })
  })

  it('uses finite barrier capacity before unit shields and breaks deterministically', () => {
    const emitter = makeUnit({
      id: 'emitter',
      team: 'attacker',
      x: 0,
      y: 0,
      fieldEffect: [{ id: 'finite', kind: 'barrier_dome', radius: 100, intervalTicks: 10, nextTick: 0, duration: 10, capacity: 60 }],
    })
    const target = makeUnit({ id: 'target', team: 'attacker', x: 40, y: 0, shield: 30, maxShield: 30 })
    const attacker = makeUnit({ id: 'attacker', team: 'defender', x: 80, y: 0 })
    const hazards: SimHazard[] = []
    const actions: BattleAction[] = []

    processFieldEffects(0, [emitter, target, attacker], hazards, actions)
    const result = applyCombatDamage(attacker, target, 90, actions, { units: [emitter, target, attacker], hazards })

    expect(result.damage).toBe(0)
    expect(target.shield).toBe(0)
    expect(hazards[0].capacity).toBe(0)
    expect(actions).toContainEqual({ unitId: 'emitter', type: 'barrier_spawn', hazardId: 'barrier_emitter_finite_0', radius: 100, damage: 60 })
    expect(actions).toContainEqual({ unitId: 'emitter', type: 'barrier_break', hazardId: 'barrier_emitter_finite_0' })
  })

  it('supports smoke and sandstorm-style hazard variants with suppression statuses', () => {
    const source = makeUnit({
      id: 'storm',
      team: 'attacker',
      x: 0,
      y: 0,
      fieldEffect: [{ id: 'sandstorm', kind: 'hazard_field', hazardType: 'smoke', radius: 100, intervalTicks: 10, nextTick: 0, duration: 21, statusEffects: [{ type: 'range_suppressed', duration: 12, value: 0.5 }, { type: 'accuracy_reduced', duration: 12, value: 0.4 }] }],
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 40, y: 0, range: 200 })
    const hazards: SimHazard[] = []

    processFieldEffects(0, [source, target], hazards, [])
    processHazards(hazards, [source, target], [])

    expect(getEffectiveActionRange(target)).toBe(100)
    expect(hasStatus(target, 'accuracy_reduced')).toBe(true)
  })
})
