import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { reserveMeleeEngagementSlot, createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { movementSystem } from '@/domains/combat/combat.movement'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { getPositioningDecision } from '@/domains/combat/combat.positioning'
import { getSizeRadius, PRNG } from '@/domains/combat/combat.utils'
import type { SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; x: number; y: number }): SimUnit {
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
    ...overrides,
  }
}

describe('combat positioning', () => {
  it('moves melee units toward their assigned slot even inside attack range', () => {
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 100 })
    const unit = makeUnit({ id: 'unit', team: 'attacker', x: 140, y: 100, range: 40 })
    reserveMeleeEngagementSlot(unit, target, createMeleeEngagementState())
    unit.x = 60
    unit.y = 100

    const distEdge = 40 - getSizeRadius(target.size) - getSizeRadius(unit.size)
    const decision = getPositioningDecision(unit, target, distEdge, getSizeRadius(target.size), getSizeRadius(unit.size))

    expect(decision.combatInRange).toBe(false)
    expect(decision.shouldMove).toBe(true)
    expect(decision.point.x).not.toBe(target.x)
  })

  it('keeps ranged units anchored when enemies are already in attack range', () => {
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 100 })
    const unit = makeUnit({ id: 'marine', team: 'attacker', x: 118, y: 100, range: 120 })
    const distEdge = 18 - getSizeRadius(target.size) - getSizeRadius(unit.size)

    const decision = getPositioningDecision(unit, target, distEdge, getSizeRadius(target.size), getSizeRadius(unit.size))

    expect(decision.combatInRange).toBe(true)
    expect(decision.shouldMove).toBe(false)
    expect(decision.point).toEqual({ x: target.x, y: target.y })
  })

  it('keeps support units anchored near full-health allies already in range', () => {
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 100, y: 100 })
    const medic = makeUnit({ id: 'medic', team: 'attacker', x: 130, y: 100, range: 120, attackType: 'heal' })
    const distEdge = 30 - getSizeRadius(ally.size) - getSizeRadius(medic.size)

    const decision = getPositioningDecision(medic, ally, distEdge, getSizeRadius(ally.size), getSizeRadius(medic.size))

    expect(decision.combatInRange).toBe(false)
    expect(decision.shouldMove).toBe(false)
  })

  it('depenetrates in-range ranged allies without starting normal movement', () => {
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 100 })
    const unit = makeUnit({ id: 'marine-a', team: 'attacker', x: 118, y: 100, range: 120, stealthWhileMoving: true })
    const ally = makeUnit({ id: 'marine-b', team: 'attacker', x: 118, y: 100, range: 120 })
    const actions: BattleAction[] = []

    movementSystem(unit, target, [unit, ally, target], actions, 0.1, new PRNG(1), createPathfindingMap([]), [])

    expect(Math.hypot(unit.x - ally.x, unit.y - ally.y)).toBeGreaterThan(0)
    expect(unit.isMoving).toBe(false)
    expect(actions).toContainEqual(expect.objectContaining({ type: 'move', unitId: unit.id, isWalking: false }))
    expect(actions.some(action => action.type === 'stealth_change' && action.modeState === 'movement_active')).toBe(false)
  })
})
