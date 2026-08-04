import type { BattleTick, SimUnit } from '@/domains/combat/combat.types'
import { collectOverlapMetrics } from '@/domains/combat/combat.metrics-overlap'
import {
  emptyMarkCombatMetrics,
  MarkMetricsAccumulator,
  type MarkCombatMetrics,
} from '@/domains/combat/combat.mark-metrics'

export const INLINE_REPLAY_OVERLAP_WORK_LIMIT = 12_000

export interface BattleReplayMetrics {
  totalTicks: number
  firstAttack: number
  averageOverlap: number
  maxOverlap: number
  overlapSamples: number
  averageOverlapRatio: number
  maxOverlapRatio: number
  severeOverlapSamples: number
  mark: MarkCombatMetrics
}

interface MetricUnitState {
  x: number
  y: number
  isDead: boolean
  size: SimUnit['size']
  isFlying: boolean
}

export function buildBattleReplayMetrics(
  logs: BattleTick[],
  initialState?: SimUnit[],
  collectOverlap = true,
): BattleReplayMetrics {
  const metrics: BattleReplayMetrics = {
    totalTicks: logs.length,
    firstAttack: -1,
    averageOverlap: 0,
    maxOverlap: 0,
    overlapSamples: 0,
    averageOverlapRatio: 0,
    maxOverlapRatio: 0,
    severeOverlapSamples: 0,
    mark: emptyMarkCombatMetrics(),
  }

  for (const log of logs) {
    if (metrics.firstAttack < 0 && log.actions.some(action => action.type === 'attack')) {
      metrics.firstAttack = log.tick
    }
  }

  if (!initialState) return metrics
  const markAccumulator = new MarkMetricsAccumulator(initialState)
  for (const log of logs) markAccumulator.consumeTick(log.tick, log.actions)
  metrics.mark = markAccumulator.snapshot()
  if (!collectOverlap) return metrics

  const units = new Map<string, MetricUnitState>()
  for (const unit of initialState) {
    units.set(unit.id, {
      x: unit.x,
      y: unit.y,
      isDead: unit.isDead,
      size: unit.size,
      isFlying: unit.isFlying,
    })
  }

  let totalOverlap = 0
  let totalOverlapRatio = 0

  for (const log of logs) {
    for (const action of log.actions) {
      const unit = units.get(action.unitId)
      if (!unit) continue
      if ((action.type === 'move' || action.type === 'knockback') && action.toX !== undefined && action.toY !== undefined) {
        unit.x = action.toX
        unit.y = action.toY
      }
      if (action.type === 'die') unit.isDead = true
    }

    const overlap = collectOverlapMetrics([...units.values()])
    totalOverlap += overlap.totalOverlap
    totalOverlapRatio += overlap.totalOverlapRatio
    metrics.overlapSamples += overlap.overlapSamples
    metrics.maxOverlap = Math.max(metrics.maxOverlap, overlap.maxOverlap)
    metrics.maxOverlapRatio = Math.max(metrics.maxOverlapRatio, overlap.maxOverlapRatio)
    metrics.severeOverlapSamples += overlap.severeOverlapSamples
  }

  metrics.averageOverlap = metrics.overlapSamples > 0 ? totalOverlap / metrics.overlapSamples : 0
  metrics.averageOverlapRatio = metrics.overlapSamples > 0 ? totalOverlapRatio / metrics.overlapSamples : 0
  return metrics
}

export function shouldCollectInlineReplayOverlapMetrics(
  tickCount: number,
  unitCount: number,
): boolean {
  return tickCount * unitCount <= INLINE_REPLAY_OVERLAP_WORK_LIMIT
}
