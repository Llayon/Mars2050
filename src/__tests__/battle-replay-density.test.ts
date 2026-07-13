import { describe, expect, it } from 'vitest'
import {
  buildReplayCrowdRenderPlan,
  type ReplayCrowdUnitInput,
} from '@/components/game/battle-replay-density'
import type { ReplayTeam } from '@/components/game/battle-replay-canvas-types'

function unit(id: string, team: ReplayTeam, overrides: Partial<ReplayCrowdUnitInput> = {}): ReplayCrowdUnitInput {
  return {
    id,
    team,
    size: 'S',
    sX: 100,
    sY: 100,
    tX: 100,
    tY: 100,
    isDead: false,
    ...overrides,
  }
}

function squad(count: number, team: ReplayTeam, overrides: Partial<ReplayCrowdUnitInput> = {}): ReplayCrowdUnitInput[] {
  return Array.from({ length: count }, (_, index) => unit(`${team}-${index}`, team, overrides))
}

describe('battle replay crowd density plan', () => {
  it('keeps sparse buckets in full mode', () => {
    const plan = buildReplayCrowdRenderPlan(squad(6, 'attacker'), 1)

    expect(plan.clusters).toHaveLength(0)
    expect(plan.units.every(view => view.mode === 'full')).toBe(true)
  })

  it('switches dense buckets to compact and cluster modes at fixed thresholds', () => {
    const compact = buildReplayCrowdRenderPlan(squad(7, 'attacker'), 1)
    const cluster = buildReplayCrowdRenderPlan(squad(16, 'attacker'), 1)

    expect(compact.clusters).toHaveLength(0)
    expect(compact.units.every(view => view.mode === 'compact')).toBe(true)
    expect(cluster.clusters).toHaveLength(1)
    expect(cluster.clusters[0]).toMatchObject({ team: 'attacker', count: 16 })
    expect(cluster.units.every(view => view.mode === 'cluster')).toBe(true)
  })

  it('does not count dead units toward density thresholds', () => {
    const units = [
      ...squad(15, 'defender'),
      unit('dead-defender', 'defender', { isDead: true }),
    ]

    const plan = buildReplayCrowdRenderPlan(units, 1)

    expect(plan.clusters).toHaveLength(0)
    expect(plan.units.filter(view => view.mode === 'compact')).toHaveLength(15)
    expect(plan.units.find(view => view.id === 'dead-defender')?.mode).toBe('full')
  })

  it('keeps attacker and defender density buckets separate', () => {
    const plan = buildReplayCrowdRenderPlan([
      ...squad(10, 'attacker'),
      ...squad(10, 'defender'),
    ], 1)

    expect(plan.clusters).toHaveLength(0)
    expect(plan.units.every(view => view.mode === 'compact')).toBe(true)
  })

  it('clusters connected dense neighbor buckets by team', () => {
    const plan = buildReplayCrowdRenderPlan([
      ...squad(8, 'attacker', { sX: 12, sY: 12, tX: 12, tY: 12 }),
      ...squad(8, 'attacker', { sX: 60, sY: 12, tX: 60, tY: 12 }),
    ], 1)

    expect(plan.clusters).toHaveLength(1)
    expect(plan.clusters[0]).toMatchObject({ team: 'attacker', count: 16 })
    expect(plan.units.every(view => view.mode === 'cluster')).toBe(true)
  })

  it('does not draw standalone cluster badges for small bridge buckets', () => {
    const plan = buildReplayCrowdRenderPlan([
      ...squad(4, 'attacker', { sX: 60, sY: 60, tX: 60, tY: 60 }),
      ...squad(6, 'attacker', { sX: 12, sY: 60, tX: 12, tY: 60 }),
      ...squad(6, 'attacker', { sX: 108, sY: 60, tX: 108, tY: 60 }),
    ], 1)

    expect(plan.clusters).toHaveLength(0)
    expect(plan.units.every(view => view.mode !== 'cluster')).toBe(true)
  })

  it('uses interpolated frame positions and preserves unit view order', () => {
    const units = [
      unit('a', 'attacker', { sX: 0, sY: 0, tX: 96, tY: 96 }),
      unit('b', 'attacker', { sX: 96, sY: 96, tX: 0, tY: 0 }),
    ]

    const plan = buildReplayCrowdRenderPlan(units, 0.5)

    expect(plan.units.map(view => view.id)).toEqual(['a', 'b'])
    expect(plan.units.map(view => [view.x, view.y])).toEqual([[48, 48], [48, 48]])
  })
})
