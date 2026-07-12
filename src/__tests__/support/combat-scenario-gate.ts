import { expect } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { BattleAction, BattleActionType, BattleResult, UnitRow } from '@/domains/combat/combat.types'
import type { CombatMetrics } from '@/domains/combat/combat.metrics'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { buildBattleReplayMetrics } from '@/components/game/battle-replay-metrics'

interface ScenarioOptions {
  trackMetrics?: boolean
}

interface MetricBounds {
  minInitialUnits?: number
  firstAttackTickMax?: number
  maxOverlapLessThan?: number
  maxOverlapRatioLessThan?: number
  averageOverlapRatioLessThan?: number
  severeOverlapSamplesLessThan?: number
  targetSwitchesLessThan?: number
  battleDurationLessThan?: number
  averageTimeToEngageMax?: number
  totalStuckTicksLessThan?: number
  meleeSlotWaitTicksLessThan?: number
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
  if (bounds.minInitialUnits !== undefined) expect(result.initialState.length, `${label}: initial units`).toBeGreaterThanOrEqual(bounds.minInitialUnits)
  if (bounds.firstAttackTickMax !== undefined) {
    expect(metrics.firstAttackTick, `${label}: first attack tick`).not.toBeNull()
    expect(metrics.firstAttackTick ?? MAX_TICKS, `${label}: first attack tick`).toBeLessThanOrEqual(bounds.firstAttackTickMax)
  }
  if (bounds.maxOverlapLessThan !== undefined) expect(metrics.maxOverlap, `${label}: max overlap`).toBeLessThan(bounds.maxOverlapLessThan)
  if (bounds.maxOverlapRatioLessThan !== undefined) expect(metrics.maxOverlapRatio, `${label}: max overlap ratio`).toBeLessThan(bounds.maxOverlapRatioLessThan)
  if (bounds.averageOverlapRatioLessThan !== undefined) expect(metrics.averageOverlapRatio, `${label}: average overlap ratio`).toBeLessThan(bounds.averageOverlapRatioLessThan)
  if (bounds.severeOverlapSamplesLessThan !== undefined) expect(metrics.severeOverlapSamples, `${label}: severe overlap samples`).toBeLessThan(bounds.severeOverlapSamplesLessThan)
  if (bounds.targetSwitchesLessThan !== undefined) expect(metrics.targetSwitches, `${label}: target switches`).toBeLessThan(bounds.targetSwitchesLessThan)
  if (bounds.battleDurationLessThan !== undefined) expect(metrics.battleDurationTicks, `${label}: battle duration`).toBeLessThan(bounds.battleDurationLessThan)
  if (bounds.averageTimeToEngageMax !== undefined && metrics.averageTimeToEngage !== null) {
    expect(metrics.averageTimeToEngage, `${label}: average time to engage`).toBeLessThanOrEqual(bounds.averageTimeToEngageMax)
  }
  if (bounds.totalStuckTicksLessThan !== undefined) expect(sumValues(metrics.stuckTicksByUnitType), `${label}: total stuck ticks`).toBeLessThan(bounds.totalStuckTicksLessThan)
  if (bounds.meleeSlotWaitTicksLessThan !== undefined) expect(metrics.meleeSlotWaitTicks, `${label}: melee slot wait ticks`).toBeLessThan(bounds.meleeSlotWaitTicksLessThan)
}

export function expectReplayMetricsAligned(result: BattleResult, label = 'scenario'): void {
  const metrics = expectMetrics(result, label)
  const replayMetrics = buildBattleReplayMetrics(result.logs, result.initialState)
  const severeDeltaLimit = Math.max(5, metrics.severeOverlapSamples * 0.001)

  expect(replayMetrics.firstAttack, `${label}: replay first attack`).toBe(metrics.firstAttackTick)
  expect(Math.abs(replayMetrics.averageOverlapRatio - metrics.averageOverlapRatio), `${label}: replay average overlap ratio`).toBeLessThanOrEqual(0.005)
  expect(Math.abs(replayMetrics.maxOverlapRatio - metrics.maxOverlapRatio), `${label}: replay max overlap ratio`).toBeLessThanOrEqual(0.005)
  expect(Math.abs(replayMetrics.severeOverlapSamples - metrics.severeOverlapSamples), `${label}: replay severe overlap samples`).toBeLessThanOrEqual(severeDeltaLimit)
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

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((total, value) => total + value, 0)
}
