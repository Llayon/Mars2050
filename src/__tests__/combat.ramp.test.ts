import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { getRampDamage } from '@/domains/combat/combat.ramp'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import { PRNG } from '@/domains/combat/combat.utils'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; type?: string }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 20,
    defense: 0,
    speed: 10,
    range: 240,
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

describe('combat ramp damage', () => {
  it('scales deterministic damage while the same target is focused', () => {
    const attacker = makeUnit({ id: 'ion', team: 'attacker', type: 'ion_crawler' })
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 0 })
    const actions: BattleAction[] = []

    expect(getRampDamage(attacker, target, 20, actions)).toBe(20)
    expect(getRampDamage(attacker, target, 20, actions)).toBe(25)
    expect(getRampDamage(attacker, target, 20, actions)).toBe(30)
    expect(actions.map(action => action.value)).toEqual([1, 1.25, 1.5])
  })

  it('resets scaling when the attacker switches targets', () => {
    const attacker = makeUnit({ id: 'ion', team: 'attacker', type: 'ion_crawler' })
    const first = makeUnit({ id: 'first', team: 'defender', x: 100, y: 0 })
    const second = makeUnit({ id: 'second', team: 'defender', x: 120, y: 0 })
    const actions: BattleAction[] = []

    expect(getRampDamage(attacker, first, 20, actions)).toBe(20)
    expect(getRampDamage(attacker, first, 20, actions)).toBe(25)
    expect(getRampDamage(attacker, second, 20, actions)).toBe(20)
    expect(actions.map(action => action.targetId)).toEqual(['first', 'first', 'second'])
    expect(actions.map(action => action.value)).toEqual([1, 1.25, 1])
  })

  it('does not emit ramp actions for units without ramp config', () => {
    const attacker = makeUnit({ id: 'marine', team: 'attacker', type: 'marine' })
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 0 })
    const actions: BattleAction[] = []

    expect(getRampDamage(attacker, target, 20, actions)).toBe(20)
    expect(getRampDamage(attacker, target, 20, actions)).toBe(20)
    expect(actions).toEqual([])
  })

  it('applies ramp only to primary damage through the action system', () => {
    const attacker = makeUnit({ id: 'ion', team: 'attacker', type: 'ion_crawler', attack: 20 })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 100, y: 0 })
    const secondary = makeUnit({ id: 'secondary', team: 'defender', x: 150, y: 10 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, secondary], hazards, actions, new PRNG(1))).toBe(true)
    attacker.actionCooldown = 0
    expect(actionSystem(attacker, primary, [attacker, primary, secondary], hazards, actions, new PRNG(1))).toBe(true)

    expect(primary.hp).toBe(55)
    expect(secondary.hp).toBe(74)
    expect(actions.filter(action => action.type === 'ramp_charge').map(action => action.value)).toEqual([1, 1.25])
  })
})
