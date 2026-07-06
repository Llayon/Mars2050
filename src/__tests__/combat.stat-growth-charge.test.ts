import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { consumeAttackCharge, processGrowthAndCharge } from '@/domains/combat/combat.growth-charge'
import type { SimUnit, Team } from '@/domains/combat/combat.types'

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
    isDead: false,
    turnSpeed: 1,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    x: 0,
    y: 0,
    ...overrides,
  }
}

describe('stat growth and attack charge primitives', () => {
  it('applies capped deterministic stat growth', () => {
    const unit = makeUnit({ id: 'rhino', team: 'attacker', statGrowth: { intervalTicks: 2, maxStacks: 2, attackMultPerStack: 0.5, hpMultPerStack: 0.1, nextTick: 2, stacks: 0 } })
    const actions: BattleAction[] = []

    for (let tick = 0; tick <= 6; tick++) processGrowthAndCharge(tick, [unit], actions)

    expect(unit.attack).toBe(22)
    expect(unit.maxHp).toBe(121)
    expect(unit.hp).toBe(121)
    expect(unit.statGrowth?.stacks).toBe(2)
    expect(actions.filter(action => action.type === 'stat_growth').map(action => action.value)).toEqual([1, 2])
  })

  it('charges between attacks and resets on release', () => {
    const unit = makeUnit({ id: 'launcher', team: 'attacker', attackCharge: { intervalTicks: 1, maxStacks: 3, attackMultPerStack: 0.25, nextTick: 1, stacks: 0 } })
    const actions: BattleAction[] = []

    for (let tick = 0; tick <= 3; tick++) processGrowthAndCharge(tick, [unit], actions)
    const damage = consumeAttackCharge(unit, 100, actions, 4)

    expect(damage).toBe(175)
    expect(unit.attackCharge?.stacks).toBe(0)
    expect(unit.attackCharge?.nextTick).toBe(5)
    expect(actions.filter(action => action.type === 'attack_charge').map(action => action.value)).toEqual([1, 2, 3])
    expect(actions).toContainEqual({ unitId: 'launcher', type: 'attack_charge_release', value: 3, damage: 75 })
  })
})
