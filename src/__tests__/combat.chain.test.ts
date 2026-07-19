import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { getChainTargets } from '@/domains/combat/combat.attack-geometry'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; type?: string }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 40,
    defense: 0,
    speed: 10,
    range: 200,
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

describe('combat chain weapons', () => {
  it('selects deterministic chain jumps from the previous target', () => {
    const attacker = makeUnit({ id: 'plasma', team: 'attacker', type: 'plasma_tank' })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 100, y: 0 })
    const first = makeUnit({ id: 'first', team: 'defender', x: 160, y: 0 })
    const second = makeUnit({ id: 'second', team: 'defender', x: 220, y: 0 })
    const outside = makeUnit({ id: 'outside', team: 'defender', x: 340, y: 0 })

    const hits = getChainTargets(attacker, primary, [outside, second, first, primary, attacker])

    expect(hits.map(hit => [hit.target.id, hit.jump])).toEqual([
      ['first', 1],
      ['second', 2],
    ])
    expect(hits[0].multiplier).toBeCloseTo(0.6)
    expect(hits[1].multiplier).toBeCloseTo(0.45)
  })

  it('applies chain damage after the primary hit', () => {
    const attacker = makeUnit({ id: 'plasma', team: 'attacker', type: 'plasma_tank' })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 100, y: 0 })
    const first = makeUnit({ id: 'first', team: 'defender', x: 160, y: 0 })
    const second = makeUnit({ id: 'second', team: 'defender', x: 220, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, second, first], hazards, actions, new PRNG(1))).toBe(true)

    expect(primary.hp).toBe(60)
    expect(first.hp).toBe(76)
    expect(second.hp).toBe(82)
    expect(actions.filter(action => action.type === 'chain_jump')).toEqual([
      { unitId: 'plasma', type: 'chain_jump', targetId: 'first', value: 1 },
      { unitId: 'plasma', type: 'chain_jump', targetId: 'second', value: 2 },
    ])
  })

  it('uses id order when chain candidates have equal distance', () => {
    const attacker = makeUnit({ id: 'plasma', team: 'attacker', type: 'plasma_tank' })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 100, y: 0 })
    const b = makeUnit({ id: 'b-target', team: 'defender', x: 150, y: 20 })
    const a = makeUnit({ id: 'a-target', team: 'defender', x: 150, y: -20 })

    expect(getChainTargets(attacker, primary, [b, primary, a, attacker])[0]?.target.id).toBe('a-target')
  })
})
