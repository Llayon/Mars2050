import type { FloatingText, ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from './battle-replay-density'

export interface ReplayRenderBudget {
  resolution: number
  maxFps: number
  clusterUnitStride: number
  corpseLifetimeMs: number
  maxFloatingTexts: number
}

interface ReplayRenderBudgetInput {
  devicePixelRatio: number
  unitCount: number
  coarsePointer: boolean
  deviceMemory?: number
}

const DENSE_REPLAY_UNIT_COUNT = 240

export function resolveReplayRenderBudget(
  input: ReplayRenderBudgetInput,
): ReplayRenderBudget {
  const dense = input.unitCount >= DENSE_REPLAY_UNIT_COUNT
  const constrained = input.coarsePointer ||
    (input.deviceMemory !== undefined && input.deviceMemory <= 4)
  const devicePixelRatio = Math.max(1, input.devicePixelRatio)

  if (constrained) {
    return {
      resolution: Math.min(devicePixelRatio, dense ? 1 : 1.25),
      maxFps: dense ? 30 : 45,
      clusterUnitStride: dense ? 3 : 1,
      corpseLifetimeMs: 700,
      maxFloatingTexts: dense ? 12 : 48,
    }
  }

  return {
    resolution: Math.min(devicePixelRatio, dense ? 1.5 : 2),
    maxFps: dense ? 45 : 60,
    clusterUnitStride: 1,
    corpseLifetimeMs: 1000,
    maxFloatingTexts: dense ? 80 : 120,
  }
}

export function getBrowserReplayRenderBudget(unitCount: number): ReplayRenderBudget {
  const deviceMemory = (
    window.navigator as Navigator & { deviceMemory?: number }
  ).deviceMemory
  return resolveReplayRenderBudget({
    devicePixelRatio: window.devicePixelRatio || 1,
    unitCount,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    deviceMemory,
  })
}

export function shouldRenderReplayUnit(
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  budget: ReplayRenderBudget,
): boolean {
  if (unit.isDead && (unit.deathAgeMs ?? 0) >= budget.corpseLifetimeMs) {
    return false
  }
  if (view.mode !== 'cluster' || budget.clusterUnitStride <= 1) return true
  return stableHash(unit.id) % budget.clusterUnitStride === 0
}

export function selectReplayFloatingTexts(
  texts: FloatingText[],
  budget: ReplayRenderBudget,
): FloatingText[] {
  return selectReplayFloatingTextsInto(texts, budget, [], new Set<number>())
}

export function selectReplayFloatingTextsInto(
  texts: FloatingText[],
  budget: ReplayRenderBudget,
  selected: FloatingText[],
  occupiedBuckets: Set<number>,
): FloatingText[] {
  if (texts.length <= budget.maxFloatingTexts) return texts
  selected.length = 0
  occupiedBuckets.clear()
  for (let index = texts.length - 1; index >= 0; index--) {
    const item = texts[index]
    const key = (Math.floor(item.x / 80) & 0xffff) * 0x10000 +
      (Math.floor(item.y / 44) & 0xffff)
    if (occupiedBuckets.has(key)) continue
    occupiedBuckets.add(key)
    selected.push(item)
    if (selected.length >= budget.maxFloatingTexts) break
  }
  return selected.reverse()
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
