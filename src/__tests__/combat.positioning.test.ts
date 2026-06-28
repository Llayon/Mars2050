import { describe, expect, it } from 'vitest'
import { reserveMeleeEngagementSlot, createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { getPositioningDecision } from '@/domains/combat/combat.positioning'
import { getSizeRadius } from '@/domains/combat/combat.utils'
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
})
