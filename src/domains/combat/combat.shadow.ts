import { simulateBattle } from './combat.engine'
import type { BattleSimulationOptions } from './combat.metrics'
import type { Obstacle } from './combat.sim.types'
import type { BattleResult, UnitRow } from './combat.types'

export interface ShadowComparison {
  legacy: BattleResult
  ecs: BattleResult
  differences: string[]
}

export function compareCombatEngines(
  attackers: UnitRow[],
  defenders: UnitRow[],
  seed: number,
  obstacles: Obstacle[] = [],
  attackerGlobals: string[] = [],
  defenderGlobals: string[] = [],
  options: Omit<BattleSimulationOptions, 'engine'> = {},
): ShadowComparison {
  const legacy = simulateBattle(cloneRows(attackers), cloneRows(defenders), seed, cloneObstacles(obstacles), attackerGlobals, defenderGlobals, { ...options, engine: 'legacy' })
  const ecs = simulateBattle(cloneRows(attackers), cloneRows(defenders), seed, cloneObstacles(obstacles), attackerGlobals, defenderGlobals, { ...options, engine: 'ecs' })
  return { legacy, ecs, differences: compareResults(legacy, ecs) }
}

function compareResults(legacy: BattleResult, ecs: BattleResult): string[] {
  const differences: string[] = []
  if (legacy.winner !== ecs.winner) differences.push(`winner:${legacy.winner}:${ecs.winner}`)
  if (legacy.terminationReason !== ecs.terminationReason) differences.push(`termination:${legacy.terminationReason}:${ecs.terminationReason}`)
  if (legacy.elapsedTicks !== ecs.elapsedTicks) differences.push(`elapsed-ticks:${legacy.elapsedTicks}:${ecs.elapsedTicks}`)
  if (!equivalent(legacy.initialState, ecs.initialState)) differences.push('initial-state')
  if (!equivalent(legacy.logs, ecs.logs)) differences.push(findFirstActionDifference(legacy, ecs))
  if (!equivalent(sortUnits(legacy.survivors), sortUnits(ecs.survivors))) differences.push('survivors')
  if (!equivalent(legacy.metrics, ecs.metrics)) differences.push('metrics')
  return differences
}

function findFirstActionDifference(legacyResult: BattleResult, ecsResult: BattleResult): string {
  const legacy = legacyResult.logs.flatMap(log => log.actions)
  const ecs = ecsResult.logs.flatMap(log => log.actions)
  if (legacy.length !== ecs.length) return `action-count:${legacy.length}:${ecs.length}`
  for (let index = 0; index < legacy.length; index++) {
    if (!equivalent(legacy[index], ecs[index])) return `action:${index}`
  }
  return `logs:${legacyResult.logs.length}:${ecsResult.logs.length}`
}

function sortUnits(units: BattleResult['survivors']): BattleResult['survivors'] {
  return [...units].sort((left, right) => left.id.localeCompare(right.id))
}

function equivalent(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) <= 1e-6
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return left === right
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => equivalent(value, right[index]))
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort()
  return keys.every(key => equivalent(leftRecord[key], rightRecord[key]))
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function cloneObstacles(obstacles: Obstacle[]): Obstacle[] {
  return obstacles.map(obstacle => ({ ...obstacle }))
}
