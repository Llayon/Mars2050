import { simulateBattle } from './combat.engine'
import type { BattleSimulationOptions } from './combat.metrics'
import type { Obstacle } from './combat.sim.types'
import type { BattleAction, BattleResult, UnitRow } from './combat.types'

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
  if (legacy.logs.length !== ecs.logs.length) differences.push(`log-count:${legacy.logs.length}:${ecs.logs.length}`)
  const actionDifference = compareActions(legacy.logs.flatMap(log => log.actions), ecs.logs.flatMap(log => log.actions))
  if (actionDifference) differences.push(actionDifference)
  const survivorDifference = compareSurvivors(legacy, ecs)
  if (survivorDifference) differences.push(survivorDifference)
  return differences
}

function compareActions(legacy: BattleAction[], ecs: BattleAction[]): string | null {
  if (legacy.length !== ecs.length) return `action-count:${legacy.length}:${ecs.length}`
  for (let index = 0; index < legacy.length; index++) {
    if (!equivalent(legacy[index], ecs[index])) return `action:${index}`
  }
  return null
}

function compareSurvivors(legacy: BattleResult, ecs: BattleResult): string | null {
  const left = legacy.survivors.map(unit => ({ id: unit.id, hp: unit.hp, x: unit.x, y: unit.y })).sort((a, b) => a.id.localeCompare(b.id))
  const right = ecs.survivors.map(unit => ({ id: unit.id, hp: unit.hp, x: unit.x, y: unit.y })).sort((a, b) => a.id.localeCompare(b.id))
  return equivalent(left, right) ? null : 'survivors'
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

