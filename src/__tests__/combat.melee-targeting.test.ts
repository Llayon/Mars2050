import { describe, expect, it } from 'vitest'
import {
  createMeleeEngagementState,
  getMeleeEngagementPoint,
  getMeleeSlotCount,
  isMeleeWaitingReady,
  reserveMeleeEngagementSlot,
} from '@/domains/combat/combat.melee-engagement'
import { targetingSystem } from '@/domains/combat/combat.targeting'
import { SpatialHash } from '@/domains/combat/spatial-hash'
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

describe('melee targeting', () => {
  it('waits around a target when every melee engagement slot is already taken', () => {
    const attacker = makeUnit({ id: 'late', team: 'attacker', x: 0, y: 0 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 40, y: 0, size: 'S' })
    const state = createMeleeEngagementState()
    const slotCount = getMeleeSlotCount(attacker, target)

    for (let i = 0; i < slotCount; i++) {
      const angle = (Math.PI * 2 * i) / slotCount
      const blocker = makeUnit({ id: `blocker-${i}`, team: 'attacker', x: target.x + Math.cos(angle) * 20, y: target.y + Math.sin(angle) * 20 })
      reserveMeleeEngagementSlot(blocker, target, state)
    }

    const hash = new SpatialHash(40)
    ;[attacker, target].forEach(unit => hash.insert(unit))

    const selected = targetingSystem(attacker, [attacker, target], state, hash)
    const waitPoint = getMeleeEngagementPoint(attacker, target)

    expect(selected?.id).toBe(target.id)
    expect(attacker.attackTargetId).toBeUndefined()
    expect(attacker.meleeWaitingTargetId).toBe(target.id)
    expect(waitPoint).not.toEqual({ x: target.x, y: target.y })
    expect(isMeleeWaitingReady(attacker, target)).toBe(false)
  })
})
