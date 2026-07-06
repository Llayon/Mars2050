import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processFormationBonuses } from '@/domains/combat/combat.formation'
import { getFormationSpacing } from '@/domains/combat/combat.runtime-primitives'
import { getTargetScore } from '@/domains/combat/combat.targeting-score'
import { TARGETING_PROFILES } from '@/domains/combat/combat.targeting.config'
import { getEffectiveActionRange, getStatusValue, hasStatus } from '@/domains/combat/combat.status'
import type { SimUnit, Team, UnitBaseStats } from '@/domains/combat/combat.types'

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

const baseStats: UnitBaseStats = {
  hp: 100,
  attack: 10,
  defense: 0,
  speed: 10,
  range: 3,
  attackType: 'single',
}

describe('formation and targeting primitives', () => {
  it('applies loose formation spacing through formation modifiers', () => {
    expect(getFormationSpacing(20, { ...baseStats, formationModifiers: { spacingMultiplier: 1.5 } })).toBe(30)
  })

  it('applies deterministic same-unit adjacency bonuses', () => {
    const a = makeUnit({
      id: 'a',
      team: 'attacker',
      x: 0,
      y: 0,
      formationModifiers: { adjacencyBonus: { radius: 80, maxStacks: 2, damageReductionPerAlly: 0.1, rangeBoostPerAlly: 0.2, attackBoostPerAlly: 0.3 } },
    })
    const b = makeUnit({ id: 'b', team: 'attacker', x: 40, y: 0 })
    const c = makeUnit({ id: 'c', team: 'attacker', x: 60, y: 0 })
    const actions: BattleAction[] = []

    processFormationBonuses(10, [c, a, b], actions)

    expect(hasStatus(a, 'damage_reduction')).toBe(true)
    expect(getEffectiveActionRange(a)).toBe(168)
    expect(getStatusValue(a, 'attack_boost')).toBe(0.6)
    expect(actions).toContainEqual({ unitId: 'a', type: 'adjacency_bonus', value: 2 })
  })

  it('lets target-priority marks influence acquisition scores without source-specific damage marks', () => {
    const shooter = makeUnit({ id: 'shooter', team: 'attacker', x: 0, y: 0 })
    const unmarked = makeUnit({ id: 'near', team: 'defender', x: 60, y: 0 })
    const marked = makeUnit({
      id: 'marked-air',
      team: 'defender',
      x: 200,
      y: 0,
      isFlying: true,
      targetMark: { sourceUnitId: 'radar', duration: 10, focusPriority: 2000 },
    })

    const nearScore = getTargetScore(shooter, unmarked, TARGETING_PROFILES.default_local, 60)
    const markedScore = getTargetScore(shooter, marked, TARGETING_PROFILES.default_local, 60)

    expect(markedScore.markPriorityScore).toBe(2000)
    expect(markedScore.total).toBeGreaterThan(nearScore.total)
  })

  it('supports runtime target priority profiles without changing acquisition radius', () => {
    const shooter = makeUnit({ id: 'shooter', team: 'attacker', x: 0, y: 0, targetPriorityProfile: 'highest_max_hp' })
    const small = makeUnit({ id: 'small', team: 'defender', x: 60, y: 0, maxHp: 100 })
    const giant = makeUnit({ id: 'giant', team: 'defender', x: 60, y: 0, maxHp: 500 })

    const smallScore = getTargetScore(shooter, small, TARGETING_PROFILES.default_local, 60)
    const giantScore = getTargetScore(shooter, giant, TARGETING_PROFILES.default_local, 60)

    expect(giantScore.runtimePriorityScore).toBe(500)
    expect(giantScore.total).toBeGreaterThan(smallScore.total)
  })
})
