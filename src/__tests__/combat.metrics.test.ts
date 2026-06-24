import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { getSizeRadius } from '@/domains/combat/combat.utils'
import type { BattleAction, BattleResult, SimUnit, UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'

interface ReplayUnit {
  id: string
  x: number
  y: number
  isDead: boolean
  isFlying: boolean
  size: SimUnit['size']
}

describe('combat movement metrics', () => {
  it('keeps a 100+ unit crowd moving into combat without timing out', () => {
    const result = simulateMetricBattle()

    expect(result.initialState.length).toBeGreaterThanOrEqual(100)
    expect(getFirstActionTick(result, 'attack')).toBeLessThanOrEqual(25)
    expect(getLastTick(result)).toBeLessThan(MAX_TICKS - 1)
  })

  it('keeps early crowd overlap under the steering threshold', () => {
    const result = simulateMetricBattle()
    const snapshot = getReplaySnapshot(result, 20)
    const metrics = getOverlapMetrics(snapshot)

    expect(metrics.averageOverlap).toBeLessThan(8)
    expect(metrics.maxOverlap).toBeLessThan(22)
  })

  it('produces identical replays for the same seed', () => {
    const first = simulateDeterministicBattle()
    const second = simulateDeterministicBattle()

    expect(second.initialState).toEqual(first.initialState)
    expect(second.logs).toEqual(first.logs)
    expect(second.survivors).toEqual(first.survivors)
    expect(second.obstacles).toEqual(first.obstacles)
  })
})

function simulateMetricBattle(): BattleResult {
  return simulateBattle(
    makeUnits('a', 6, 'shock_trooper', 820),
    makeUnits('d', 6, 'alien_bug', 380),
    12345,
    []
  )
}

function simulateDeterministicBattle(): BattleResult {
  return simulateBattle(
    makeUnits('a', 1, 'exosuit', 850),
    makeUnits('d', 1, 'alien_bug', 360),
    54321
  )
}

function makeUnits(prefix: string, count: number, unitType: UnitTypeKey, startY: number): UnitRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${index}`,
    colony_id: prefix,
    unit_type: unitType,
    hp_current: 9999,
    grid_x: String(180 + (index % 3) * 60),
    grid_y: String(startY + Math.floor(index / 3) * 35),
    tier: 1,
    upgrade_path: []
  }))
}

function getFirstActionTick(result: BattleResult, type: BattleAction['type']): number {
  return result.logs.find(log => log.actions.some(action => action.type === type))?.tick ?? MAX_TICKS
}

function getLastTick(result: BattleResult): number {
  return result.logs.at(-1)?.tick ?? 0
}

function getReplaySnapshot(result: BattleResult, tickLimit: number): ReplayUnit[] {
  const units = new Map<string, ReplayUnit>()
  for (const unit of result.initialState) {
    units.set(unit.id, {
      id: unit.id,
      x: unit.x,
      y: unit.y,
      isDead: false,
      isFlying: unit.isFlying,
      size: unit.size
    })
  }

  for (const log of result.logs) {
    if (log.tick > tickLimit) break
    for (const action of log.actions) {
      const unit = units.get(action.unitId)
      if (!unit) continue

      if (action.type === 'move' && action.toX !== undefined && action.toY !== undefined) {
        unit.x = action.toX
        unit.y = action.toY
      } else if (action.type === 'die') {
        unit.isDead = true
      }
    }
  }

  return [...units.values()]
}

function getOverlapMetrics(units: ReplayUnit[]): { averageOverlap: number; maxOverlap: number } {
  const alive = units.filter(unit => !unit.isDead)
  let totalOverlap = 0
  let maxOverlap = 0
  let overlapPairs = 0

  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const first = alive[i]
      const second = alive[j]
      if (first.isFlying !== second.isFlying) continue

      const minDistance = (getSizeRadius(first.size) + getSizeRadius(second.size)) * 0.95
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      const overlap = Math.max(0, minDistance - distance)
      if (overlap <= 0) continue

      totalOverlap += overlap
      maxOverlap = Math.max(maxOverlap, overlap)
      overlapPairs++
    }
  }

  return {
    averageOverlap: overlapPairs > 0 ? totalOverlap / overlapPairs : 0,
    maxOverlap
  }
}
