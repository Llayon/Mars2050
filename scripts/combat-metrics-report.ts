import { getSimulatorPreset, SIMULATOR_PRESET_OPTIONS } from '@/app/simulator2/simulator.presets'
import { buildBattleReplayMetrics } from '@/components/game/battle-replay-metrics'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { BattleResult, UnitRow } from '@/domains/combat/combat.types'

interface MetricsReportRow {
  preset: string
  units: number
  ticks: number
  firstAttack: number | null
  averageOverlapRatio: number
  maxOverlapRatio: number
  severeOverlapSamples: number
  targetSwitches: number
  stuckTicks: number
  meleeSlotWaitTicks: number
  replayAverageRatioDelta: number
  replayMaxRatioDelta: number
  replaySevereSamplesDelta: number
}

const DEFAULT_PRESETS = ['ranged_duel', 'massive_clash', 'zerg_rush'] as const

function main(): void {
  const args = new Set(process.argv.slice(2))
  const presets = getRequestedPresets(process.argv.slice(2))
  const rows = presets.map(buildReportRow)

  if (args.has('--json')) {
    console.log(JSON.stringify(rows, null, 2))
    return
  }

  console.table(rows.map(row => ({
    preset: row.preset,
    units: row.units,
    ticks: row.ticks,
    first: row.firstAttack ?? 'none',
    avgRatio: format(row.averageOverlapRatio),
    maxRatio: format(row.maxOverlapRatio),
    severe: row.severeOverlapSamples,
    switches: row.targetSwitches,
    stuck: row.stuckTicks,
    meleeWait: row.meleeSlotWaitTicks,
    replayAvgDelta: format(row.replayAverageRatioDelta),
    replayMaxDelta: format(row.replayMaxRatioDelta),
    replaySevereDelta: row.replaySevereSamplesDelta,
  })))
}

function getRequestedPresets(args: string[]): string[] {
  if (args.includes('--all')) return SIMULATOR_PRESET_OPTIONS.map(option => option.id)
  const presetArg = args.find(arg => arg.startsWith('--preset='))
  if (presetArg) return presetArg.slice('--preset='.length).split(',').filter(Boolean)
  return [...DEFAULT_PRESETS]
}

function buildReportRow(presetId: string): MetricsReportRow {
  const result = simulatePreset(presetId)
  const metrics = result.metrics
  if (!metrics) throw new Error(`Missing metrics for preset: ${presetId}`)

  const replay = buildBattleReplayMetrics(result.logs, result.initialState)
  return {
    preset: presetId,
    units: result.initialState.length,
    ticks: result.logs.length,
    firstAttack: metrics.firstAttackTick,
    averageOverlapRatio: metrics.averageOverlapRatio,
    maxOverlapRatio: metrics.maxOverlapRatio,
    severeOverlapSamples: metrics.severeOverlapSamples,
    targetSwitches: metrics.targetSwitches,
    stuckTicks: sumValues(metrics.stuckTicksByUnitType),
    meleeSlotWaitTicks: metrics.meleeSlotWaitTicks,
    replayAverageRatioDelta: Math.abs(replay.averageOverlapRatio - metrics.averageOverlapRatio),
    replayMaxRatioDelta: Math.abs(replay.maxOverlapRatio - metrics.maxOverlapRatio),
    replaySevereSamplesDelta: Math.abs(replay.severeOverlapSamples - metrics.severeOverlapSamples),
  }
}

function simulatePreset(presetId: string): BattleResult {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)

  return simulateBattle(
    cloneRows(preset.attackers),
    cloneRows(preset.defenders),
    24680,
    [],
    [],
    [],
    { trackMetrics: true }
  )
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((total, value) => total + value, 0)
}

function format(value: number): string {
  return value.toFixed(4)
}

main()
