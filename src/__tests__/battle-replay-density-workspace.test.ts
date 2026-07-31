import { describe, expect, it } from 'vitest'
import type { ReplayTeam } from '@/components/game/battle-replay-canvas-types'
import {
  buildReplayCrowdRenderPlan,
  type ReplayCrowdRenderPlan,
  type ReplayCrowdUnitInput,
} from '@/components/game/battle-replay-density'
import { ReplayCrowdRenderWorkspace } from '@/components/game/battle-replay-density-workspace'

function unit(
  id: string,
  team: ReplayTeam,
  overrides: Partial<ReplayCrowdUnitInput> = {},
): ReplayCrowdUnitInput {
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

function squad(
  count: number,
  team: ReplayTeam,
  overrides: Partial<ReplayCrowdUnitInput> = {},
): ReplayCrowdUnitInput[] {
  return Array.from(
    { length: count },
    (_, index) => unit(`${team}-${index}`, team, overrides),
  )
}

function expectPlanParity(
  workspace: ReplayCrowdRenderWorkspace,
  units: ReplayCrowdUnitInput[],
  progress: number,
): ReplayCrowdRenderPlan {
  const expected = buildReplayCrowdRenderPlan(units, progress)
  const actual = workspace.update(units, progress)
  expect(actual).toEqual(expected)
  return actual
}

describe('battle replay crowd density workspace', () => {
  it('matches the allocating planner across sparse and dense layouts', () => {
    const workspace = new ReplayCrowdRenderWorkspace()
    const layouts = [
      squad(6, 'attacker'),
      squad(7, 'defender'),
      squad(16, 'attacker'),
      [
        ...squad(8, 'attacker', { sX: 12, sY: 12, tX: 12, tY: 12 }),
        ...squad(8, 'attacker', { sX: 60, sY: 12, tX: 60, tY: 12 }),
      ],
      [
        ...squad(16, 'attacker', { sX: 72, sY: 72, tX: 72, tY: 72 }),
        ...squad(16, 'defender', { sX: 520, sY: 1080, tX: 520, tY: 1080 }),
        unit('dead', 'defender', { isDead: true }),
      ],
    ]

    for (const layout of layouts) expectPlanParity(workspace, layout, 1)
  })

  it('matches interpolation and disconnected cluster ordering', () => {
    const workspace = new ReplayCrowdRenderWorkspace()
    const units = [
      ...squad(16, 'defender', { sX: 500, sY: 1000, tX: 500, tY: 900 }),
      ...squad(16, 'attacker', { sX: 100, sY: 300, tX: 100, tY: 200 }),
      ...squad(16, 'attacker', { sX: 400, sY: 500, tX: 400, tY: 400 }),
      unit('moving', 'attacker', { sX: 0, sY: 0, tX: 96, tY: 96 }),
    ]

    expectPlanParity(workspace, units, 0.5)
  })

  it('matches deterministic mixed layouts over successive frames', () => {
    const workspace = new ReplayCrowdRenderWorkspace()
    const units = Array.from({ length: 180 }, (_, index) => unit(
      `mixed-${index}`,
      index % 3 === 0 ? 'defender' : 'attacker',
      {
        size: index % 4 === 0 ? 'L' : 'S',
        sX: (index * 37) % 600,
        sY: (index * 61) % 1200,
        tX: (index * 43) % 600,
        tY: (index * 71) % 1200,
        isDead: index % 19 === 0,
      },
    ))

    for (const progress of [0, 0.15, 0.5, 0.85, 1]) {
      expectPlanParity(workspace, units, progress)
    }
  })

  it('reuses plans and views after warm-up', () => {
    const workspace = new ReplayCrowdRenderWorkspace()
    const units = squad(16, 'attacker')
    const first = workspace.update(units, 0.25)
    const unitArray = first.units
    const clusterArray = first.clusters
    const unitViews = [...first.units]
    const clusterViews = [...first.clusters]
    const created = { ...workspace.stats }

    const second = workspace.update(units, 0.75)

    expect(second).toBe(first)
    expect(second.units).toBe(unitArray)
    expect(second.clusters).toBe(clusterArray)
    second.units.forEach((view, index) => {
      expect(view).toBe(unitViews[index])
    })
    second.clusters.forEach((view, index) => {
      expect(view).toBe(clusterViews[index])
    })
    expect(workspace.stats).toMatchObject({
      createdUnitViews: created.createdUnitViews,
      createdBuckets: created.createdBuckets,
      createdClusterViews: created.createdClusterViews,
      frames: created.frames + 1,
    })
  })

  it('only grows its unit view pool for a new roster slot', () => {
    const workspace = new ReplayCrowdRenderWorkspace()
    const initial = squad(6, 'attacker')
    workspace.update(initial, 1)
    const created = workspace.stats.createdUnitViews

    workspace.update([...initial, unit('spawn', 'attacker')], 1)

    expect(workspace.stats.createdUnitViews).toBe(created + 1)
  })
})
