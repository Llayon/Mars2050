import { describe, expect, it } from 'vitest'
import {
  createMeleeEngagementState,
  getMeleeEngagementPoint,
  getMeleeSlotCount,
  hasMeleeEngagementSlot,
  reserveMeleeEngagementSlot,
} from '@/domains/combat/combat.melee-engagement'
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
    range: 40,
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

describe('melee engagement slots', () => {
  it('caps slot count by target and attacker size deterministically', () => {
    const unit = makeUnit({ id: 'unit', team: 'attacker', x: 0, y: 0, size: 'S' })
    const target = makeUnit({ id: 'target', team: 'defender', x: 50, y: 0, size: 'XL' })

    expect(getMeleeSlotCount(unit, target)).toBe(12)
  })

  it('reserves sectors until a target is surrounded', () => {
    const target = makeUnit({ id: 'target', team: 'defender', x: 0, y: 0, size: 'S' })
    const state = createMeleeEngagementState()
    const slotCount = getMeleeSlotCount(makeUnit({ id: 'sample', team: 'attacker', x: 20, y: 0 }), target)

    for (let i = 0; i < slotCount; i++) {
      const angle = (Math.PI * 2 * i) / slotCount
      const unit = makeUnit({ id: `unit-${i}`, team: 'attacker', x: Math.cos(angle) * 20, y: Math.sin(angle) * 20 })
      expect(reserveMeleeEngagementSlot(unit, target, state)).toBe(true)
    }

    const late = makeUnit({ id: 'late', team: 'attacker', x: 20, y: 0 })

    expect(hasMeleeEngagementSlot(late, target, state)).toBe(false)
    expect(reserveMeleeEngagementSlot(late, target, state)).toBe(false)
  })

  it('does not consume slots for ranged units', () => {
    const target = makeUnit({ id: 'target', team: 'defender', x: 0, y: 0 })
    const ranged = makeUnit({ id: 'ranged', team: 'attacker', x: 100, y: 0, range: 120 })
    const state = createMeleeEngagementState()

    expect(reserveMeleeEngagementSlot(ranged, target, state)).toBe(true)
    expect(state.slotsByTarget[target.id]).toBeUndefined()
  })

  it('stores the reserved slot and exposes a stable arrival point', () => {
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 100, size: 'M' })
    const unit = makeUnit({ id: 'unit', team: 'attacker', x: 140, y: 100, range: 40, size: 'S' })
    const state = createMeleeEngagementState()

    expect(reserveMeleeEngagementSlot(unit, target, state)).toBe(true)

    const point = getMeleeEngagementPoint(unit, target)
    const expectedDistance = getSizeRadius(target.size) + getSizeRadius(unit.size) + unit.range * 0.75

    expect(unit.meleeSlotTargetId).toBe(target.id)
    expect(unit.meleeSlotIndex).toBeDefined()
    expect(unit.meleeSlotCount).toBe(getMeleeSlotCount(unit, target))
    expect(point).not.toBeNull()
    expect(Math.hypot(point!.x - target.x, point!.y - target.y)).toBeCloseTo(expectedDistance)
  })
})
