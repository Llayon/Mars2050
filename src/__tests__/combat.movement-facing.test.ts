import { describe, expect, it } from 'vitest'
import { movementSystem } from '@/domains/combat/combat.movement'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { PRNG } from '@/domains/combat/combat.utils'
import type { BattleAction, SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; x: number; y: number }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 100,
    range: 160,
    attackType: 'single',
    actionCooldownMax: 10,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    isDead: false,
    turnSpeed: 100,
    currentAngle: Math.PI,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    ...overrides,
  }
}

describe('movement facing', () => {
  it('turns stationary ranged units toward their target instead of their preferred range point', () => {
    const unit = makeUnit({ id: 'unit', team: 'attacker', x: 0, y: 0 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 0 })
    const actions: BattleAction[] = []

    movementSystem(unit, target, [unit, target], actions, 0.1, new PRNG(1), createPathfindingMap([]), [])

    expect(unit.currentAngle).toBeCloseTo(0)
    expect(actions.at(-1)?.facingAngle).toBeCloseTo(0)
  })

  it('turns static units toward targets without moving them', () => {
    const turret = makeUnit({ id: 'turret', team: 'attacker', x: 0, y: 0, speed: 0 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 0 })
    const actions: BattleAction[] = []

    movementSystem(turret, target, [turret, target], actions, 0.1, new PRNG(1), createPathfindingMap([]), [])

    expect(turret.currentAngle).toBeCloseTo(0)
    expect(turret.x).toBe(0)
    expect(turret.y).toBe(0)
    expect(actions.at(-1)?.isWalking).toBe(false)
    expect(actions.at(-1)?.facingAngle).toBeCloseTo(0)
  })

  it('does not push combat-ready units while they wait in attack range', () => {
    const unit = makeUnit({ id: 'unit', team: 'attacker', x: 100, y: 100, currentAngle: 0 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 112, y: 100, size: 'XL' })
    const actions: BattleAction[] = []

    movementSystem(unit, target, [unit, target], actions, 0.1, new PRNG(1), createPathfindingMap([]), [])

    expect(unit.x).toBe(100)
    expect(unit.y).toBe(100)
    expect(unit.velocity).toEqual({ x: 0, y: 0 })
    expect(actions.every(action => action.fromX === action.toX && action.fromY === action.toY)).toBe(true)
  })
})
