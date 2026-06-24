import { describe, expect, it } from 'vitest'
import { TARGETING_PROFILES } from '@/domains/combat/combat.targeting.config'
import { getEffectiveCombatTags, getTargetScore } from '@/domains/combat/combat.targeting-score'
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

describe('target score breakdown', () => {
  it('returns inspectable score parts for anti-air targeting', () => {
    const attacker = makeUnit({ id: 'turret', team: 'attacker', type: 'aa_turret', x: 0, y: 0 })
    const aircraft = makeUnit({ id: 'gunship', team: 'defender', type: 'gunship', x: 200, y: 0, isFlying: true })

    const score = getTargetScore(attacker, aircraft, TARGETING_PROFILES.anti_air, 100)

    expect(score.targetId).toBe('gunship')
    expect(score.tags).toContain('aircraft')
    expect(score.preferredTagScore).toBe(500)
    expect(score.avoidedTagPenalty).toBe(0)
    expect(score.tagScore).toBe(500)
    expect(score.total).toBeCloseTo(score.distanceScore + score.tagScore)
  })

  it('adds runtime tags from shield and attack type state', () => {
    const healer = makeUnit({ id: 'healer', team: 'defender', type: 'marine', x: 100, y: 0, attackType: 'heal', shield: 10 })

    const tags = getEffectiveCombatTags(healer)

    expect(tags).toContain('healer')
    expect(tags).toContain('shielded')
  })

  it('neutralizes positive tag score when a preferred target is far beyond the nearest enemy', () => {
    const attacker = makeUnit({ id: 'plasma', team: 'attacker', type: 'plasma_tank', x: 0, y: 0 })
    const farArmored = makeUnit({ id: 'armored', team: 'defender', type: 'behemoth_tank', x: 400, y: 0, size: 'XL' })

    const score = getTargetScore(attacker, farArmored, TARGETING_PROFILES.anti_armor, 100)

    expect(score.preferredTagScore).toBeGreaterThan(0)
    expect(score.tagDistancePenalty).toBe(score.preferredTagScore - score.avoidedTagPenalty)
    expect(score.tagScore).toBe(0)
  })
})
