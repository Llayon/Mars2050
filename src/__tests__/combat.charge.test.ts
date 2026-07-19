import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { getChargeDamage, recordChargeMovement } from '@/domains/combat/combat.charge'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
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

describe('combat charge damage', () => {
  it('records capped movement distance only for configured charge units', () => {
    const buggy = makeUnit({ id: 'buggy', team: 'attacker', type: 'scavenger_buggy' })
    const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine' })

    recordChargeMovement(buggy, 120)
    recordChargeMovement(buggy, 120)
    recordChargeMovement(marine, 120)

    expect(buggy.chargeDistance).toBe(180)
    expect(marine.chargeDistance).toBeUndefined()
  })

  it('converts charge distance into capped primary-hit damage and resets it', () => {
    const buggy = makeUnit({ id: 'buggy', team: 'attacker', type: 'scavenger_buggy', chargeDistance: 180 })
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []

    const damage = getChargeDamage(buggy, target, 15, actions)

    expect(damage).toBe(33)
    expect(buggy.chargeDistance).toBe(0)
    expect(actions).toEqual([{ unitId: 'buggy', type: 'charge_damage', targetId: 'target', value: 2.2 }])
  })

  it('resets low charge without emitting a replay action', () => {
    const buggy = makeUnit({ id: 'buggy', team: 'attacker', type: 'scavenger_buggy', chargeDistance: 30 })
    const target = makeUnit({ id: 'target', team: 'defender' })
    const actions: BattleAction[] = []

    const damage = getChargeDamage(buggy, target, 15, actions)

    expect(damage).toBe(15)
    expect(buggy.chargeDistance).toBe(0)
    expect(actions).toEqual([])
  })

  it('applies charge damage through primary actionSystem hits', () => {
    const buggy = makeUnit({
      id: 'buggy',
      team: 'attacker',
      type: 'scavenger_buggy',
      attack: 15,
      range: 120,
      actionCooldownMax: 10,
      chargeDistance: 180,
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 60, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    const acted = actionSystem(buggy, target, [buggy, target], hazards, actions, new PRNG(1))

    expect(acted).toBe(true)
    expect(target.hp).toBe(67)
    expect(actions).toEqual([
      { unitId: 'buggy', type: 'attack', targetId: 'target' },
      { unitId: 'buggy', type: 'charge_damage', targetId: 'target', value: 2.2 },
      { unitId: 'buggy', type: 'damage', targetId: 'target', damage: 33 },
    ])
  })
})
