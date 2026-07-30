import { describe, expect, it } from 'vitest'
import {
  buildBattleReplayMetrics,
  shouldCollectInlineReplayOverlapMetrics,
} from '@/components/game/battle-replay-metrics'
import type { BattleTick, SimUnit, Team } from '@/domains/combat/combat.types'

function simUnit(id: string, team: Team, x: number, y: number, overrides: Partial<SimUnit> = {}): SimUnit {
  return {
    id,
    team,
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
    x,
    y,
    isDead: false,
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    turnSpeed: 1,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    ...overrides,
  }
}

describe('battle replay metrics', () => {
  it('tracks first attack tick and full-replay overlap ratios', () => {
    const logs: BattleTick[] = [
      { tick: 0, actions: [{ unitId: 'a', type: 'move', toX: 100, toY: 100 }] },
      { tick: 1, actions: [{ unitId: 'a', type: 'attack', targetId: 'b', damage: 10 }] },
      { tick: 2, actions: [{ unitId: 'b', type: 'knockback', toX: 106, toY: 100 }] },
    ]

    const metrics = buildBattleReplayMetrics(logs, [
      simUnit('a', 'attacker', 100, 100),
      simUnit('b', 'defender', 130, 100),
    ])

    expect(metrics.totalTicks).toBe(3)
    expect(metrics.firstAttack).toBe(1)
    expect(metrics.overlapSamples).toBe(1)
    expect(metrics.averageOverlap).toBeCloseTo(13)
    expect(metrics.maxOverlapRatio).toBeCloseTo(13 / 19)
    expect(metrics.severeOverlapSamples).toBe(1)
  })

  it('counts severe overlaps at fifty percent normalized overlap', () => {
    const metrics = buildBattleReplayMetrics([{ tick: 0, actions: [] }], [
      simUnit('a', 'attacker', 100, 100),
      simUnit('b', 'defender', 100, 100),
    ])

    expect(metrics.overlapSamples).toBe(1)
    expect(metrics.averageOverlap).toBeCloseTo(19)
    expect(metrics.averageOverlapRatio).toBeCloseTo(1)
    expect(metrics.maxOverlapRatio).toBeCloseTo(1)
    expect(metrics.severeOverlapSamples).toBe(1)
  })

  it('does not mix flying and ground overlap pairs', () => {
    const metrics = buildBattleReplayMetrics([{ tick: 0, actions: [] }], [
      simUnit('ground', 'attacker', 100, 100),
      simUnit('air', 'defender', 100, 100, { isFlying: true }),
    ])

    expect(metrics.overlapSamples).toBe(0)
    expect(metrics.averageOverlap).toBe(0)
    expect(metrics.maxOverlap).toBe(0)
  })

  it('removes dead units from later overlap samples', () => {
    const logs: BattleTick[] = [
      { tick: 0, actions: [] },
      { tick: 1, actions: [{ unitId: 'b', type: 'die' }] },
    ]

    const metrics = buildBattleReplayMetrics(logs, [
      simUnit('a', 'attacker', 100, 100),
      simUnit('b', 'defender', 100, 100),
    ])

    expect(metrics.overlapSamples).toBe(1)
    expect(metrics.severeOverlapSamples).toBe(1)
  })

  it('skips synchronous overlap analysis for large replay workloads', () => {
    expect(shouldCollectInlineReplayOverlapMetrics(82, 100)).toBe(true)
    expect(shouldCollectInlineReplayOverlapMetrics(205, 605)).toBe(false)
  })
})
