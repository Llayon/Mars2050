import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { getBarrageImpacts, getBarrageTargets } from '@/domains/combat/combat.attack-geometry'
import { getPositioningDecision } from '@/domains/combat/combat.positioning'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; type?: string }): SimUnit {
  return {
    type: 'marine',
    hp: 500,
    maxHp: 500,
    attack: 160,
    defense: 0,
    speed: 10,
    range: 400,
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
    size: 'L',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    ...overrides,
  }
}

describe('combat barrage weapons', () => {
  it('creates deterministic artillery impacts around the primary target', () => {
    const attacker = makeUnit({ id: 'artillery', team: 'attacker', type: 'artillery_crawler' })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 220, y: 0, size: 'S' })

    const impacts = getBarrageImpacts(attacker, primary)

    expect(impacts).toHaveLength(4)
    expect(impacts[0]).toMatchObject({ index: 0, x: 220, y: 0, radius: 70 })
    expect(impacts.map(impact => impact.index)).toEqual([0, 1, 2, 3])
  })

  it('selects barrage targets by impact distance and id', () => {
    const attacker = makeUnit({ id: 'artillery', team: 'attacker', type: 'artillery_crawler' })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 220, y: 0, size: 'S' })
    const side = makeUnit({ id: 'side', team: 'defender', x: 250, y: 0, size: 'S' })
    const outside = makeUnit({ id: 'outside', team: 'defender', x: 330, y: 0, size: 'S' })
    const impact = getBarrageImpacts(attacker, primary)[0]

    expect(getBarrageTargets(attacker, impact, [outside, side, primary, attacker]).map(unit => unit.id)).toEqual(['primary', 'side'])
  })

  it('applies barrage impacts through the action system', () => {
    const attacker = makeUnit({ id: 'artillery', team: 'attacker', type: 'artillery_crawler' })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 220, y: 0, size: 'S' })
    const side = makeUnit({ id: 'side', team: 'defender', x: 250, y: 0, size: 'S' })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, side], hazards, actions, new PRNG(1))).toBe(true)

    expect(primary.hp).toBe(196)
    expect(side.hp).toBe(284)
    expect(actions.filter(action => action.type === 'barrage_marker')).toHaveLength(4)
    expect(actions.filter(action => action.type === 'barrage_impact')).toHaveLength(4)
  })

  it('blocks artillery attacks inside minimum range and asks positioning to back away', () => {
    const attacker = makeUnit({ id: 'artillery', team: 'attacker', type: 'artillery_crawler' })
    const closeTarget = makeUnit({ id: 'close', team: 'defender', x: 120, y: 0, size: 'S' })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, closeTarget, [attacker, closeTarget], hazards, actions, new PRNG(1))).toBe(false)

    const decision = getPositioningDecision(attacker, closeTarget, 82, 10, 28)
    expect(decision.combatInRange).toBe(false)
    expect(decision.shouldMove).toBe(true)
    expect(decision.point.x).toBeLessThan(attacker.x)
  })
})
