import type { BattleTick, SimUnit } from '@/domains/combat/combat.types'
import { getSizeRadius } from '@/domains/combat/combat.utils'

export interface BattleReplayMetrics {
  totalTicks: number
  firstAttack: number
  averageOverlap: number
  maxOverlap: number
  overlapSamples: number
  averageOverlapRatio: number
  maxOverlapRatio: number
  severeOverlapSamples: number
}

interface MetricUnitState {
  x: number
  y: number
  isDead: boolean
  size: SimUnit['size']
  isFlying: boolean
}

export function buildBattleReplayMetrics(logs: BattleTick[], initialState?: SimUnit[]): BattleReplayMetrics {
  const metrics: BattleReplayMetrics = {
    totalTicks: logs.length,
    firstAttack: -1,
    averageOverlap: 0,
    maxOverlap: 0,
    overlapSamples: 0,
    averageOverlapRatio: 0,
    maxOverlapRatio: 0,
    severeOverlapSamples: 0,
  }

  for (const log of logs) {
    if (metrics.firstAttack < 0 && log.actions.some(action => action.type === 'attack')) {
      metrics.firstAttack = log.tick
    }
  }

  if (!initialState) return metrics

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

    const alive = Array.from(units.values()).filter(unit => !unit.isDead)
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const first = alive[i]
        const second = alive[j]
        if (first.isFlying !== second.isFlying) continue

        const minDistance = (getSizeRadius(first.size) + getSizeRadius(second.size)) * 0.95
        const distance = Math.hypot(first.x - second.x, first.y - second.y)
        const overlap = Math.max(0, minDistance - distance)
        if (overlap <= 0) continue

        const overlapRatio = overlap / minDistance
        totalOverlap += overlap
        totalOverlapRatio += overlapRatio
        metrics.overlapSamples++
        metrics.maxOverlap = Math.max(metrics.maxOverlap, overlap)
        metrics.maxOverlapRatio = Math.max(metrics.maxOverlapRatio, overlapRatio)
        if (overlapRatio >= 0.5) metrics.severeOverlapSamples++
      }
    }
  }

  metrics.averageOverlap = metrics.overlapSamples > 0 ? totalOverlap / metrics.overlapSamples : 0
  metrics.averageOverlapRatio = metrics.overlapSamples > 0 ? totalOverlapRatio / metrics.overlapSamples : 0
  return metrics
}
