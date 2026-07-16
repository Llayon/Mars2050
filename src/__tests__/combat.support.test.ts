import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { canReceiveHealAction } from '@/domains/combat/combat.support'
import { actionSystem } from '@/domains/combat/combat.systems'
import { targetingSystem } from '@/domains/combat/combat.targeting'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { SpatialHash } from '@/domains/combat/spatial-hash'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; x: number; y: number; type?: string }): SimUnit {
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

function makeHash(units: SimUnit[]): SpatialHash {
  const hash = new SpatialHash(40)
  units.forEach(unit => hash.insert(unit))
  return hash
}

describe('combat support targeting', () => {
  it('lets engineer repair mechanical units but not organic units', () => {
    const engineer = makeUnit({ id: 'engineer', team: 'attacker', type: 'engineer', x: 0, y: 0, attackType: 'heal' })
    const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', x: 80, y: 0, hp: 50 })
    const rover = makeUnit({ id: 'rover', team: 'attacker', type: 'gatling_rover', x: 120, y: 0, hp: 50 })

    expect(canReceiveHealAction(engineer, marine)).toBe(false)
    expect(canReceiveHealAction(engineer, rover)).toBe(true)
  })

  it('selects wounded mechanical allies before wounded organic allies for engineer repair', () => {
    const engineer = makeUnit({ id: 'engineer', team: 'attacker', type: 'engineer', x: 0, y: 0, attackType: 'heal' })
    const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', x: 60, y: 0, hp: 10 })
    const rover = makeUnit({ id: 'rover', team: 'attacker', type: 'gatling_rover', x: 120, y: 0, hp: 50 })
    const units = [engineer, marine, rover]

    const target = targetingSystem(engineer, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('rover')
  })

  it('blocks direct engineer healing on organic units in the action system', () => {
    const engineer = makeUnit({ id: 'engineer', team: 'attacker', type: 'engineer', x: 0, y: 0, attack: 10, attackType: 'heal' })
    const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', x: 80, y: 0, hp: 50 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(engineer, marine, [engineer, marine], hazards, actions, new PRNG(1))).toBe(false)

    expect(marine.hp).toBe(50)
    expect(actions).toEqual([])
  })

  it('allows direct engineer healing on mechanical units in the action system', () => {
    const engineer = makeUnit({ id: 'engineer', team: 'attacker', type: 'engineer', x: 0, y: 0, attack: 10, attackType: 'heal' })
    const rover = makeUnit({ id: 'rover', team: 'attacker', type: 'gatling_rover', x: 80, y: 0, hp: 50 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(engineer, rover, [engineer, rover], hazards, actions, new PRNG(1))).toBe(true)

    expect(rover.hp).toBe(60)
    expect(actions).toEqual([{ unitId: 'engineer', type: 'heal', targetId: 'rover', damage: 10 }])
  })

  it('records only actual healing when a target is almost full', () => {
    const medic = makeUnit({ id: 'medic', team: 'attacker', type: 'medic', x: 0, y: 0, attack: 34, attackType: 'heal' })
    const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', x: 80, y: 0, hp: 98 })
    const actions: BattleAction[] = []

    expect(actionSystem(medic, marine, [medic, marine], [], actions, new PRNG(1))).toBe(true)
    expect(marine.hp).toBe(100)
    expect(actions).toEqual([{ unitId: 'medic', type: 'heal', targetId: 'marine', damage: 2 }])
  })
})
