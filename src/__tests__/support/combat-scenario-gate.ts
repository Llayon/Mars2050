import { expect } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { BattleAction, BattleActionType, BattleResult, UnitRow } from '@/domains/combat/combat.types'
import type { CombatMetrics } from '@/domains/combat/combat.metrics'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'

interface ScenarioOptions {
  trackMetrics?: boolean
}

interface MetricBounds {
  firstAttackTickMax?: number
  maxOverlapLessThan?: number
  maxOverlapRatioLessThan?: number
  averageOverlapRatioLessThan?: number
  severeOverlapSamplesLessThan?: number
  targetSwitchesLessThan?: number
  battleDurationLessThan?: number
  averageTimeToEngageMax?: number
}

export function simulateScenario(presetId: string, options: ScenarioOptions = {}): BattleResult {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing preset: ${presetId}`)

  return simulateBattle(
    cloneRows(preset.attackers),
    cloneRows(preset.defenders),
    24680,
    [],
    [],
    [],
    { trackMetrics: options.trackMetrics ?? false }
  )
}

export function flattenActions(result: BattleResult): BattleAction[] {
  return result.logs.flatMap(log => log.actions)
}

export function countActions(result: BattleResult, type: BattleActionType): number {
  return flattenActions(result).filter(action => action.type === type).length
}

export function expectBattleTerminates(result: BattleResult, label = 'scenario'): void {
  expect(result.logs.length, label).toBeGreaterThan(0)
  expect(result.logs.at(-1)?.tick ?? MAX_TICKS, label).toBeLessThan(MAX_TICKS)
}

export function expectReplayHas(result: BattleResult, actionTypes: BattleActionType[], label = 'scenario'): void {
  const actions = flattenActions(result).map(action => action.type)
  for (const actionType of actionTypes) expect(actions, label).toContain(actionType)
}

export function expectSpawnBounded(result: BattleResult, max: number, label = 'scenario'): void {
  const spawnCount = countActions(result, 'spawn')
  expect(spawnCount, label).toBeGreaterThan(0)
  expect(spawnCount, label).toBeLessThanOrEqual(max)
}

export function expectMetricBounds(result: BattleResult, bounds: MetricBounds, label = 'scenario'): void {
  const metrics = expectMetrics(result, label)
  if (bounds.firstAttackTickMax !== undefined) {
    expect(metrics.firstAttackTick, label).not.toBeNull()
    expect(metrics.firstAttackTick ?? MAX_TICKS, label).toBeLessThanOrEqual(bounds.firstAttackTickMax)
  }
  if (bounds.maxOverlapLessThan !== undefined) expect(metrics.maxOverlap, label).toBeLessThan(bounds.maxOverlapLessThan)
  if (bounds.maxOverlapRatioLessThan !== undefined) expect(metrics.maxOverlapRatio, label).toBeLessThan(bounds.maxOverlapRatioLessThan)
  if (bounds.averageOverlapRatioLessThan !== undefined) expect(metrics.averageOverlapRatio, label).toBeLessThan(bounds.averageOverlapRatioLessThan)
  if (bounds.severeOverlapSamplesLessThan !== undefined) expect(metrics.severeOverlapSamples, label).toBeLessThan(bounds.severeOverlapSamplesLessThan)
  if (bounds.targetSwitchesLessThan !== undefined) expect(metrics.targetSwitches, label).toBeLessThan(bounds.targetSwitchesLessThan)
  if (bounds.battleDurationLessThan !== undefined) expect(metrics.battleDurationTicks, label).toBeLessThan(bounds.battleDurationLessThan)
  if (bounds.averageTimeToEngageMax !== undefined && metrics.averageTimeToEngage !== null) {
    expect(metrics.averageTimeToEngage, label).toBeLessThanOrEqual(bounds.averageTimeToEngageMax)
  }
}

export function expectDeterministicScenario(presetId: string): void {
  const first = simulateScenario(presetId)
  const second = simulateScenario(presetId)

  expect(second.initialState, presetId).toEqual(first.initialState)
  expect(second.logs, presetId).toEqual(first.logs)
  expect(second.survivors, presetId).toEqual(first.survivors)
  expectBattleTerminates(first, presetId)
}

function expectMetrics(result: BattleResult, label: string): CombatMetrics {
  expect(result.metrics, label).toBeDefined()
  return result.metrics as CombatMetrics
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}
