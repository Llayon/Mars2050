import { describe, expect, it } from 'vitest'
import { applyDepenetration } from '@/domains/combat/combat.depenetration'
import type { BattleAction, SimUnit, Team } from '@/domains/combat/combat.types'

function unit(id: string, x: number, y: number, overrides: Partial<SimUnit> = {}): SimUnit {
  return {
    id,
    team: 'attacker',
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 100,
    range: 120,
    attackType: 'single',
    actionCooldownMax: 10,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    x,
    y,
    isDead: false,
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    turnSpeed: 1,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    ...overrides,
  }
}

describe('combat depenetration', () => {
  it('separates overlapping same-team units and emits replay moves', () => {
    const units = [unit('a', 100, 100), unit('b', 106, 100)]
    const actions: BattleAction[] = []

    applyDepenetration(units, actions)

    expect(Math.hypot(units[0].x - units[1].x, units[0].y - units[1].y)).toBeGreaterThan(6)
    expect(actions.filter(action => action.type === 'move')).toHaveLength(2)
    expect(actions.every(action => action.isWalking === false)).toBe(true)
    expect(actions.every(action => action.motionKind === 'depenetration')).toBe(true)
  })

  it('uses deterministic pair vectors for identical positions', () => {
    const first = [unit('a', 100, 100), unit('b', 100, 100)]
    const second = [unit('a', 100, 100), unit('b', 100, 100)]
    const firstActions: BattleAction[] = []
    const secondActions: BattleAction[] = []

    applyDepenetration(first, firstActions)
    applyDepenetration(second, secondActions)

    expect(first.map(item => ({ x: item.x, y: item.y }))).toEqual(second.map(item => ({ x: item.x, y: item.y })))
    expect(firstActions).toEqual(secondActions)
  })

  it('does not separate flying units from ground units', () => {
    const units = [unit('ground', 100, 100), unit('air', 100, 100, { isFlying: true })]
    const actions: BattleAction[] = []

    applyDepenetration(units, actions)

    expect(units[0].x).toBe(100)
    expect(units[1].x).toBe(100)
    expect(actions).toHaveLength(0)
  })

  it('keeps immobile units fixed when a movable unit can depenetrate', () => {
    const units = [
      unit('wall', 100, 100, { speed: 0, team: 'defender' as Team }),
      unit('marine', 106, 100),
    ]
    const actions: BattleAction[] = []

    applyDepenetration(units, actions)

    expect(units[0].x).toBe(100)
    expect(units[0].y).toBe(100)
    expect(units[1].x).toBeGreaterThan(106)
    expect(actions.map(action => action.unitId)).toEqual(['marine'])
  })

  it('clamps correction to battlefield bounds', () => {
    const units = [unit('left', 0, 100), unit('right', 1, 100)]
    const actions: BattleAction[] = []

    applyDepenetration(units, actions)

    expect(units.every(item => item.x >= 0 && item.y >= 0)).toBe(true)
    expect(actions.length).toBeGreaterThan(0)
  })
})
