import { describe, expect, it } from 'vitest'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { applyStatus } from '@/domains/combat/combat.status'
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

function makeHash(units: SimUnit[]): SpatialHash {
  const hash = new SpatialHash(40)
  units.forEach(unit => hash.insert(unit))
  return hash
}

describe('range_suppressed status', () => {
  it('shrinks local ranged acquisition without preventing movement fallback', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0, range: 300 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 410, y: 0 })
    const units = [attacker, far]
    applyStatus(attacker, { type: 'range_suppressed', duration: 5, value: 0.5 })

    const target = targetingSystem(attacker, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('far')
    expect(attacker.attackTargetId).toBeUndefined()
    expect(attacker.aggroLockTicks).toBe(0)
  })

  it('lets range boost expand local ranged acquisition', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0, range: 160 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 330, y: 0 })
    const units = [attacker, far]
    applyStatus(attacker, { type: 'range_boost', duration: 5, value: 0.5 })

    const target = targetingSystem(attacker, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('far')
    expect(attacker.attackTargetId).toBe('far')
    expect(attacker.aggroLockTicks).toBe(10)
  })
})
