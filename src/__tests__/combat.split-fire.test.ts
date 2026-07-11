import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { getSplitFireTargets } from '@/domains/combat/combat.split-fire'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; type?: string }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 50,
    defense: 0,
    speed: 10,
    range: 160,
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
    size: 'M',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    ...overrides,
  }
}

describe('combat split fire', () => {
  it('selects nearest secondary targets while excluding the primary target', () => {
    const attacker = makeUnit({ id: 'gatling', team: 'attacker', type: 'gatling_rover', canTargetAir: true })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 120, y: 0 })
    const near = makeUnit({ id: 'near', team: 'defender', x: 80, y: 0 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 150, y: 0 })
    const outsideLimit = makeUnit({ id: 'outside', team: 'defender', x: 210, y: 0 })

    expect(getSplitFireTargets(attacker, primary, [outsideLimit, far, primary, near, attacker]).map(unit => unit.id)).toEqual(['near', 'far'])
  })

  it('uses deterministic id order when split-fire candidates have equal distance', () => {
    const attacker = makeUnit({ id: 'gatling', team: 'attacker', type: 'gatling_rover', canTargetAir: true })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 120, y: 0 })
    const b = makeUnit({ id: 'b-target', team: 'defender', x: 90, y: 0 })
    const a = makeUnit({ id: 'a-target', team: 'defender', x: -90, y: 0 })

    expect(getSplitFireTargets(attacker, primary, [attacker, primary, b, a]).map(unit => unit.id)).toEqual(['a-target', 'b-target'])
  })

  it('applies split-fire damage through the combat action system', () => {
    const attacker = makeUnit({ id: 'gatling', team: 'attacker', type: 'gatling_rover', canTargetAir: true })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 120, y: 0 })
    const sideA = makeUnit({ id: 'side-a', team: 'defender', x: 80, y: 0 })
    const sideB = makeUnit({ id: 'side-b', team: 'defender', x: 150, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, sideB, sideA], hazards, actions, new PRNG(1))).toBe(true)

    expect(primary.hp).toBe(50)
    expect(sideA.hp).toBe(70)
    expect(sideB.hp).toBe(70)
    expect(actions.filter(action => action.type === 'split_fire')).toEqual([
      { unitId: 'gatling', type: 'split_fire', targetId: 'side-a' },
      { unitId: 'gatling', type: 'split_fire', targetId: 'side-b' },
    ])
  })

  it('does not force minimum HP damage for secondary hits when the profile opts out', () => {
    const attacker = makeUnit({
      id: 'suppression',
      team: 'attacker',
      attack: 4,
      splitFire: { maxTargets: 1, damageMultiplier: 0.25, allowMinimumDamage: false },
      statusOnHit: [{ type: 'output_suppressed', duration: 6, value: 0.2 }],
    })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 120, y: 0, defense: 0 })
    const side = makeUnit({ id: 'side', team: 'defender', x: 80, y: 0, defense: 5 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, side], hazards, actions, new PRNG(1))).toBe(true)

    expect(primary.hp).toBe(96)
    expect(side.hp).toBe(100)
    expect(actions).toContainEqual({ unitId: 'side', type: 'status_apply', statusType: 'output_suppressed', value: 0.2 })
  })
})
