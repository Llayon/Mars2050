import { describe, expect, it } from 'vitest'
import { getEffectiveActionRangeAgainst } from '@/domains/combat/combat.weapon-rules'
import { actionSystem } from '@/domains/combat/combat.systems'
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
    range: 100,
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

describe('conditional target range', () => {
  it('extends action range only for matching air targets', () => {
    const attacker = makeUnit({ id: 'aa', team: 'attacker', canTargetAir: true, conditionalRange: [{ target: 'air', rangeAdd: 60 }] })
    const air = makeUnit({ id: 'air', team: 'defender', x: 130, isFlying: true })
    const ground = makeUnit({ id: 'ground', team: 'defender', x: 130 })

    expect(getEffectiveActionRangeAgainst(attacker, air)).toBe(160)
    expect(getEffectiveActionRangeAgainst(attacker, ground)).toBe(100)
  })

  it('uses target-aware range in action resolution', () => {
    const attacker = makeUnit({ id: 'aa', team: 'attacker', canTargetAir: true, conditionalRange: [{ target: 'air', rangeAdd: 60 }] })
    const air = makeUnit({ id: 'air', team: 'defender', x: 130, isFlying: true })
    const ground = makeUnit({ id: 'ground', team: 'defender', x: 130 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, ground, [attacker, ground], hazards, actions, new PRNG(1))).toBe(false)
    expect(actionSystem(attacker, air, [attacker, air], hazards, actions, new PRNG(1))).toBe(true)
    expect(air.hp).toBe(90)
  })
})
