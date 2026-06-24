import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
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
    ...overrides
  }
}

function makeHash(units: SimUnit[]): SpatialHash {
  const hash = new SpatialHash(40)
  units.forEach(unit => hash.insert(unit))
  return hash
}

describe('targetingSystem aggro', () => {
  it('keeps a valid locked target before searching for closer enemies', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0, attackTargetId: 'locked', aggroLockTicks: 3 })
    const locked = makeUnit({ id: 'locked', team: 'defender', x: 300, y: 0 })
    const closer = makeUnit({ id: 'closer', team: 'defender', x: 20, y: 0 })
    const units = [attacker, locked, closer]

    const target = targetingSystem(attacker, units, {}, makeHash(units))

    expect(target?.id).toBe('locked')
    expect(attacker.attackTargetId).toBe('locked')
    expect(attacker.aggroLockTicks).toBe(2)
  })

  it('prefers local acquisition targets over far low HP enemies', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const local = makeUnit({ id: 'local', team: 'defender', x: 239, y: 0, hp: 100 })
    const farWounded = makeUnit({ id: 'far-wounded', team: 'defender', x: 245, y: 0, hp: 1 })
    const units = [attacker, local, farWounded]

    const target = targetingSystem(attacker, units, {}, makeHash(units))

    expect(target?.id).toBe('local')
    expect(attacker.attackTargetId).toBe('local')
    expect(attacker.aggroLockTicks).toBe(10)
  })

  it('uses a global movement fallback without locking distant enemies', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 500, y: 0 })
    const units = [attacker, far]

    const target = targetingSystem(attacker, units, {}, makeHash(units))

    expect(target?.id).toBe('far')
    expect(attacker.attackTargetId).toBeUndefined()
    expect(attacker.aggroLockTicks).toBe(0)
  })

  it('allows special long-range units to acquire targets globally', () => {
    const sniper = makeUnit({ id: 'sniper', team: 'attacker', type: 'sniper', x: 0, y: 0 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 500, y: 0 })
    const units = [sniper, far]

    const target = targetingSystem(sniper, units, {}, makeHash(units))

    expect(target?.id).toBe('far')
    expect(sniper.attackTargetId).toBe('far')
    expect(sniper.aggroLockTicks).toBe(10)
  })

  it('drives global acquisition from unit config', () => {
    const previousProfile = UNIT_TYPES.marine.baseStats.targetingProfile
    UNIT_TYPES.marine.baseStats.targetingProfile = 'global'

    try {
      const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', x: 0, y: 0 })
      const far = makeUnit({ id: 'far', team: 'defender', x: 500, y: 0 })
      const units = [marine, far]

      const target = targetingSystem(marine, units, {}, makeHash(units))

      expect(target?.id).toBe('far')
      expect(marine.attackTargetId).toBe('far')
      expect(marine.aggroLockTicks).toBe(10)
    } finally {
      UNIT_TYPES.marine.baseStats.targetingProfile = previousProfile
    }
  })

  it('uses aggro scoring to prefer lower HP targets at equal distance', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const healthy = makeUnit({ id: 'healthy', team: 'defender', x: 100, y: 0, hp: 100 })
    const wounded = makeUnit({ id: 'wounded', team: 'defender', x: -100, y: 0, hp: 10 })
    const units = [attacker, healthy, wounded]

    const target = targetingSystem(attacker, units, {}, makeHash(units))

    expect(target?.id).toBe('wounded')
    expect(attacker.attackTargetId).toBe('wounded')
    expect(attacker.aggroLockTicks).toBe(10)
  })
})
