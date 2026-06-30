import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { getSideWeaponTargets } from '@/domains/combat/combat.side-weapon'
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
    size: 'M',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    ...overrides,
  }
}

describe('combat side weapons', () => {
  it('selects nearest secondary targets while excluding the primary target', () => {
    const attacker = makeUnit({ id: 'goliath', team: 'attacker', type: 'goliath_gunship', isFlying: true, canTargetAir: true })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 120, y: 0 })
    const near = makeUnit({ id: 'near', team: 'defender', x: 80, y: 0 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 170, y: 0 })
    const outsideLimit = makeUnit({ id: 'outside', team: 'defender', x: 190, y: 0 })

    expect(getSideWeaponTargets(attacker, primary, [outsideLimit, far, primary, near, attacker]).map(unit => unit.id)).toEqual(['near', 'far'])
  })

  it('can hit aircraft only when side weapon allows anti-air targeting', () => {
    const attacker = makeUnit({ id: 'goliath', team: 'attacker', type: 'goliath_gunship', isFlying: true, canTargetAir: true })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 120, y: 0 })
    const air = makeUnit({ id: 'air', team: 'defender', x: 80, y: 0, isFlying: true })

    expect(getSideWeaponTargets(attacker, primary, [attacker, primary, air]).map(unit => unit.id)).toEqual(['air'])
  })

  it('applies side weapon damage through the combat action system', () => {
    const attacker = makeUnit({ id: 'goliath', team: 'attacker', type: 'goliath_gunship', isFlying: true, canTargetAir: true })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 120, y: 0 })
    const sideA = makeUnit({ id: 'side-a', team: 'defender', x: 80, y: 0 })
    const sideB = makeUnit({ id: 'side-b', team: 'defender', x: 170, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, sideB, sideA], hazards, actions, new PRNG(1))).toBe(true)

    expect(primary.hp).toBe(50)
    expect(sideA.hp).toBe(76)
    expect(sideB.hp).toBe(76)
    expect(actions.filter(action => action.type === 'side_weapon_attack')).toEqual([
      { unitId: 'goliath', type: 'side_weapon_attack', targetId: 'side-a' },
      { unitId: 'goliath', type: 'side_weapon_attack', targetId: 'side-b' },
    ])
  })
})
