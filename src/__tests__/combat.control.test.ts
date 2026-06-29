import { describe, expect, it } from 'vitest'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { applyStatus } from '@/domains/combat/combat.status'
import { targetingSystem } from '@/domains/combat/combat.targeting'
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

describe('combat control statuses', () => {
  it('prevents hacked units from acquiring or keeping targets', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0, attackTargetId: 'target', aggroLockTicks: 5 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 40, y: 0 })
    applyStatus(attacker, { type: 'hacked', duration: 5 })

    const selected = targetingSystem(attacker, [attacker, target], createMeleeEngagementState())

    expect(selected).toBeNull()
    expect(attacker.attackTargetId).toBeUndefined()
    expect(attacker.aggroLockTicks).toBe(0)
  })
})
