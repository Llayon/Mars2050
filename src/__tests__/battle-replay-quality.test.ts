import { describe, expect, it } from 'vitest'
import type { ReplayUnit } from '@/components/game/battle-replay-canvas-types'
import { createReplayUnitVisualState } from '@/components/game/battle-replay-visual-state'
import type { ReplayCrowdUnitView } from '@/components/game/battle-replay-density'
import {
  resolveReplayRenderBudget,
  selectReplayFloatingTexts,
  selectReplayFloatingTextsInto,
  shouldRenderReplayUnit,
} from '@/components/game/battle-replay-quality'

const unit: ReplayUnit = {
  id: 'marine-1',
  type: 'marine',
  team: 'attacker',
  hp: 10,
  maxHp: 10,
  size: 'S',
  sX: 100,
  sY: 100,
  tX: 100,
  tY: 100,
  isDead: false,
  isFlying: false,
  emp: false,
  stealth: false,
  flash: 0,
  visual: createReplayUnitVisualState('attacker'),
}

const view: ReplayCrowdUnitView = {
  id: unit.id,
  x: 100,
  y: 100,
  radius: 10,
  mode: 'full',
}

describe('battle replay render budget', () => {
  it('caps dense mobile replays at native resolution and 30 FPS', () => {
    expect(resolveReplayRenderBudget({
      devicePixelRatio: 3,
      unitCount: 600,
      coarsePointer: true,
      deviceMemory: 4,
    })).toEqual({
      resolution: 1,
      maxFps: 30,
      clusterUnitStride: 3,
      corpseLifetimeMs: 700,
      maxFloatingTexts: 12,
    })
  })

  it('preserves higher quality for sparse desktop replays', () => {
    expect(resolveReplayRenderBudget({
      devicePixelRatio: 3,
      unitCount: 80,
      coarsePointer: false,
      deviceMemory: 8,
    })).toMatchObject({
      resolution: 2,
      maxFps: 60,
      clusterUnitStride: 1,
    })
  })

  it('only samples dense cluster members on constrained devices', () => {
    const budget = resolveReplayRenderBudget({
      devicePixelRatio: 3,
      unitCount: 600,
      coarsePointer: true,
    })
    const clustered = { ...view, mode: 'cluster' as const }
    const renderedIds = Array.from({ length: 90 }, (_, index) => ({
      ...unit,
      id: `marine-${index}`,
    })).filter(candidate => shouldRenderReplayUnit(candidate, clustered, budget))

    expect(renderedIds.length).toBeGreaterThan(0)
    expect(renderedIds.length).toBeLessThanOrEqual(35)
    expect(shouldRenderReplayUnit(unit, view, budget)).toBe(true)
  })

  it('removes expired corpses while retaining the death beat', () => {
    const budget = resolveReplayRenderBudget({
      devicePixelRatio: 1,
      unitCount: 600,
      coarsePointer: true,
    })

    expect(shouldRenderReplayUnit(
      { ...unit, isDead: true, deathAgeMs: 300 },
      view,
      budget,
    )).toBe(true)
    expect(shouldRenderReplayUnit(
      { ...unit, isDead: true, deathAgeMs: 800 },
      view,
      budget,
    )).toBe(false)
  })

  it('spatially thins floating text under a dense mobile budget', () => {
    const budget = resolveReplayRenderBudget({
      devicePixelRatio: 3,
      unitCount: 600,
      coarsePointer: true,
    })
    const texts = Array.from({ length: 60 }, (_, index) => ({
      text: `-${index}`,
      x: 100 + (index % 3),
      y: 100 + (index % 4),
      color: '#ffffff',
      age: 0,
    }))

    const selected = selectReplayFloatingTexts(texts, budget)

    expect(selected).toHaveLength(1)
    expect(selected[0].text).toBe('-59')
  })

  it('reuses caller-owned buffers while thinning floating text', () => {
    const budget = resolveReplayRenderBudget({
      devicePixelRatio: 3,
      unitCount: 600,
      coarsePointer: true,
    })
    const texts = Array.from({ length: 60 }, (_, index) => ({
      text: `-${index}`,
      x: 100 + index * 90,
      y: 100,
      color: '#ffffff',
      age: 0,
    }))
    const selected: typeof texts = []
    const buckets = new Set<number>()

    const first = selectReplayFloatingTextsInto(
      texts,
      budget,
      selected,
      buckets,
    )
    const second = selectReplayFloatingTextsInto(
      texts.slice().reverse(),
      budget,
      selected,
      buckets,
    )

    expect(first).toBe(selected)
    expect(second).toBe(selected)
    expect(second).toHaveLength(budget.maxFloatingTexts)
  })
})
