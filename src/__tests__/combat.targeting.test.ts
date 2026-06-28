import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { createMeleeEngagementState, reserveMeleeEngagementSlot } from '@/domains/combat/combat.melee-engagement'
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

    const target = targetingSystem(attacker, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('locked')
    expect(attacker.attackTargetId).toBe('locked')
    expect(attacker.aggroLockTicks).toBe(2)
  })

  it('prefers local acquisition targets over far low HP enemies', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const local = makeUnit({ id: 'local', team: 'defender', x: 239, y: 0, hp: 100 })
    const farWounded = makeUnit({ id: 'far-wounded', team: 'defender', x: 245, y: 0, hp: 1 })
    const units = [attacker, local, farWounded]

    const target = targetingSystem(attacker, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('local')
    expect(attacker.attackTargetId).toBe('local')
    expect(attacker.aggroLockTicks).toBe(10)
  })

  it('uses a global movement fallback without locking distant enemies', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 500, y: 0 })
    const units = [attacker, far]

    const target = targetingSystem(attacker, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('far')
    expect(attacker.attackTargetId).toBeUndefined()
    expect(attacker.aggroLockTicks).toBe(0)
  })

  it('allows special long-range units to acquire targets globally', () => {
    const sniper = makeUnit({ id: 'sniper', team: 'attacker', type: 'sniper', x: 0, y: 0 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 500, y: 0 })
    const units = [sniper, far]

    const target = targetingSystem(sniper, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('far')
    expect(sniper.attackTargetId).toBe('far')
    expect(sniper.aggroLockTicks).toBe(12)
  })

  it('drives global acquisition from unit config', () => {
    const previousProfile = UNIT_TYPES.marine.baseStats.targetingProfile
    UNIT_TYPES.marine.baseStats.targetingProfile = 'long_range_priority'

    try {
      const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', x: 0, y: 0 })
      const far = makeUnit({ id: 'far', team: 'defender', x: 500, y: 0 })
      const units = [marine, far]

      const target = targetingSystem(marine, units, createMeleeEngagementState(), makeHash(units))

      expect(target?.id).toBe('far')
      expect(marine.attackTargetId).toBe('far')
      expect(marine.aggroLockTicks).toBe(12)
    } finally {
      UNIT_TYPES.marine.baseStats.targetingProfile = previousProfile
    }
  })

  it('uses aggro scoring to prefer lower HP targets at equal distance', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const healthy = makeUnit({ id: 'healthy', team: 'defender', x: 100, y: 0, hp: 100 })
    const wounded = makeUnit({ id: 'wounded', team: 'defender', x: -100, y: 0, hp: 10 })
    const units = [attacker, healthy, wounded]

    const target = targetingSystem(attacker, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('wounded')
    expect(attacker.attackTargetId).toBe('wounded')
    expect(attacker.aggroLockTicks).toBe(10)
  })

  it('keeps heal priority on wounded allies before support anchoring', () => {
    const medic = makeUnit({ id: 'medic', team: 'attacker', type: 'medic', x: 0, y: 0, attackType: 'heal' })
    const wounded = makeUnit({ id: 'wounded', team: 'attacker', type: 'marine', x: 180, y: 0, hp: 50 })
    const frontline = makeUnit({ id: 'frontline', team: 'attacker', type: 'marine', x: 260, y: 0 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 280, y: 0 })
    const units = [medic, wounded, frontline, enemy]

    const target = targetingSystem(medic, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('wounded')
  })

  it('anchors healers to frontline combat allies when nobody is wounded', () => {
    const medic = makeUnit({ id: 'medic', team: 'attacker', type: 'medic', x: 0, y: 0, attackType: 'heal' })
    const otherSupport = makeUnit({ id: 'other-support', team: 'attacker', type: 'officer', x: 20, y: 0, attackType: 'heal' })
    const frontline = makeUnit({ id: 'frontline', team: 'attacker', type: 'marine', x: 260, y: 0 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 280, y: 0 })
    const units = [medic, otherSupport, frontline, enemy]

    const target = targetingSystem(medic, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('frontline')
  })

  it('keeps healers near local frontline instead of chasing far wounded allies', () => {
    const medic = makeUnit({ id: 'medic', team: 'attacker', type: 'medic', x: 0, y: 0, attackType: 'heal' })
    const frontline = makeUnit({ id: 'frontline', team: 'attacker', type: 'marine', x: 220, y: 0 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 250, y: 0 })
    const farWounded = makeUnit({ id: 'far-wounded', team: 'attacker', type: 'marine', x: 900, y: 0, hp: 10 })
    const units = [medic, frontline, enemy, farWounded]

    const target = targetingSystem(medic, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('frontline')
  })

  it('uses anti-air profile to prefer aircraft over a closer ground target', () => {
    const turret = makeUnit({ id: 'turret', team: 'attacker', type: 'aa_turret', x: 0, y: 0, range: 280, canTargetAir: true })
    const ground = makeUnit({ id: 'ground', team: 'defender', type: 'marine', x: 120, y: 0 })
    const aircraft = makeUnit({ id: 'aircraft', team: 'defender', type: 'gunship', x: 180, y: 0, isFlying: true })
    const units = [turret, ground, aircraft]

    const target = targetingSystem(turret, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('aircraft')
    expect(turret.attackTargetId).toBe('aircraft')
  })

  it('uses anti-armor profile to prefer armored heavy targets within local acquisition', () => {
    const attacker = makeUnit({ id: 'plasma', team: 'attacker', type: 'plasma_tank', x: 0, y: 0, range: 240 })
    const infantry = makeUnit({ id: 'infantry', team: 'defender', type: 'marine', x: 110, y: 0 })
    const armored = makeUnit({ id: 'armored', team: 'defender', type: 'behemoth_tank', x: 150, y: 0, size: 'XL' })
    const units = [attacker, infantry, armored]

    const target = targetingSystem(attacker, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('armored')
    expect(attacker.attackTargetId).toBe('armored')
  })

  it('does not chase extreme tag preference over a much closer valid target', () => {
    const attacker = makeUnit({ id: 'plasma', team: 'attacker', type: 'plasma_tank', x: 0, y: 0, range: 240 })
    const infantry = makeUnit({ id: 'infantry', team: 'defender', type: 'marine', x: 100, y: 0 })
    const farArmored = makeUnit({ id: 'far-armored', team: 'defender', type: 'behemoth_tank', x: 350, y: 0, size: 'XL' })
    const units = [attacker, infantry, farArmored]

    const target = targetingSystem(attacker, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('infantry')
    expect(attacker.attackTargetId).toBe('infantry')
  })

  it('uses assassin profile to prefer support targets without fixed unit roles', () => {
    const hunter = makeUnit({ id: 'hunter', team: 'attacker', type: 'bounty_hunter', x: 0, y: 0, range: 240, canTargetAir: true })
    const infantry = makeUnit({ id: 'infantry', team: 'defender', type: 'marine', x: 100, y: 0 })
    const medic = makeUnit({ id: 'medic', team: 'defender', type: 'medic', x: 220, y: 0, attackType: 'heal' })
    const units = [hunter, infantry, medic]

    const target = targetingSystem(hunter, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('medic')
    expect(hunter.attackTargetId).toBe('medic')
  })

  it('selects another target when a melee target has no open engagement slots', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0, range: 40 })
    const surrounded = makeUnit({ id: 'surrounded', team: 'defender', x: 40, y: 0, size: 'S' })
    const open = makeUnit({ id: 'open', team: 'defender', x: 90, y: 0, size: 'S' })
    const state = createMeleeEngagementState()

    for (let i = 0; i < 6; i++) {
      const blocker = makeUnit({ id: `blocker-${i}`, team: 'attacker', x: 40 + Math.cos(i) * 15, y: Math.sin(i) * 15, range: 40 })
      reserveMeleeEngagementSlot(blocker, surrounded, state)
    }

    const units = [attacker, surrounded, open]
    const target = targetingSystem(attacker, units, state, makeHash(units))

    expect(target?.id).toBe('open')
    expect(attacker.attackTargetId).toBe('open')
  })

  it('clears a stale melee slot when a locked target is no longer valid', () => {
    const attacker = makeUnit({
      id: 'attacker',
      team: 'attacker',
      x: 0,
      y: 0,
      range: 40,
      attackTargetId: 'dead',
      aggroLockTicks: 2,
      meleeSlotTargetId: 'dead',
      meleeSlotIndex: 1,
    })
    const dead = makeUnit({ id: 'dead', team: 'defender', x: 40, y: 0, isDead: true })
    const units = [attacker, dead]

    const target = targetingSystem(attacker, units, createMeleeEngagementState(), makeHash(units))

    expect(target).toBeNull()
    expect(attacker.meleeSlotTargetId).toBeUndefined()
    expect(attacker.meleeSlotIndex).toBeUndefined()
  })
})
