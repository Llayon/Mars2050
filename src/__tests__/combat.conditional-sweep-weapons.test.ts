import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { BattleAction, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; x: number; y: number }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 20,
    defense: 0,
    speed: 10,
    range: 200,
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

describe('conditional and sweep weapon primitives', () => {
  it('activates conditional AoE only when enough enemies are clustered', () => {
    const attacker = makeUnit({ id: 'rhino', team: 'attacker', x: 0, y: 0, conditionalAttackMode: { minTargets: 3, radius: 80, damageMultiplier: 0.5 } })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 80, y: 0, hp: 100 })
    const secondaryA = makeUnit({ id: 'a', team: 'defender', x: 90, y: 0 })
    const secondaryB = makeUnit({ id: 'b', team: 'defender', x: 95, y: 0 })
    const actions: BattleAction[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, secondaryA, secondaryB], [], actions, new PRNG(1))).toBe(true)

    expect(primary.hp).toBe(80)
    expect(secondaryA.hp).toBe(90)
    expect(secondaryB.hp).toBe(90)
    expect(actions).toContainEqual({ unitId: 'rhino', type: 'conditional_attack_mode', targetId: 'primary', radius: 80, value: 0.5 })
  })

  it('applies deterministic sweep hits by geometry and id', () => {
    const attacker = makeUnit({ id: 'abyss', team: 'attacker', x: 0, y: 0, attack: 50, sweepAttack: { width: 20, damageMultiplier: 0.5, maxTargets: 2 } })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 80, y: 0, hp: 100 })
    const first = makeUnit({ id: 'first', team: 'defender', x: 82, y: 10 })
    const second = makeUnit({ id: 'second', team: 'defender', x: 82, y: -10 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 140, y: 80 })
    const actions: BattleAction[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, second, first, far], [], actions, new PRNG(2))).toBe(true)

    expect(first.hp).toBe(75)
    expect(second.hp).toBe(75)
    expect(far.hp).toBe(100)
    expect(actions.filter(action => action.type === 'sweep_hit').map(action => action.targetId)).toEqual(['first', 'second'])
  })
})
