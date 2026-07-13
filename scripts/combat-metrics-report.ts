import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

interface BaselineCompareRow extends MetricsReportRow {
  deltaTicks: number | null
  deltaAverageOverlapRatio: number | null
  deltaSevereOverlapSamples: number | null
  deltaTargetSwitches: number | null
  deltaStuckTicks: number | null
  deltaMeleeSlotWaitTicks: number | null
}

const DEFAULT_PRESETS = ['ranged_duel', 'marine_crowd_qa', 'massive_clash', 'zerg_rush'] as const

function main(): void {
  const rawArgs = process.argv.slice(2)
  const args = new Set(rawArgs)
  const presets = getRequestedPresets(rawArgs)
  const rows = presets.map(buildReportRow)
  const baselinePath = getArgValue(rawArgs, '--compare=')

  if (args.has('--update-baseline')) {
    writeBaseline(getBaselinePath(rawArgs), rows)
    return
  }

  if (baselinePath) {
    const comparedRows = compareRows(rows, readBaseline(baselinePath))
    if (args.has('--json')) console.log(JSON.stringify(comparedRows, null, 2))
    else printCompareTable(comparedRows)
    return
  }

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
  const presetArg = getArgValue(args, '--preset=')
  if (presetArg) return presetArg.split(',').filter(Boolean)
  return [...DEFAULT_PRESETS]
}

function getArgValue(args: string[], prefix: string): string | undefined {
  return args.find(arg => arg.startsWith(prefix))?.slice(prefix.length)
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

function readBaseline(path: string): MetricsReportRow[] {
  const resolved = resolve(path)
  if (!existsSync(resolved)) throw new Error(`Missing baseline file: ${resolved}`)
  return JSON.parse(readFileSync(resolved, 'utf8')) as MetricsReportRow[]
}

function writeBaseline(path: string, rows: MetricsReportRow[]): void {
  const resolved = resolve(path)
  writeFileSync(resolved, `${JSON.stringify(rows, null, 2)}\n`)
  console.log(`Updated combat metrics baseline: ${resolved}`)
}

function getBaselinePath(args: string[]): string {
  return getArgValue(args, '--baseline=') ?? 'docs/combat-metrics-baseline.json'
}

function compareRows(rows: MetricsReportRow[], baseline: MetricsReportRow[]): BaselineCompareRow[] {
  const baselineByPreset = new Map(baseline.map(row => [row.preset, row]))
  return rows.map(row => {
    const previous = baselineByPreset.get(row.preset)
    return {
      ...row,
      deltaTicks: previous ? row.ticks - previous.ticks : null,
      deltaAverageOverlapRatio: previous ? normalizeDelta(row.averageOverlapRatio - previous.averageOverlapRatio) : null,
      deltaSevereOverlapSamples: previous ? row.severeOverlapSamples - previous.severeOverlapSamples : null,
      deltaTargetSwitches: previous ? row.targetSwitches - previous.targetSwitches : null,
      deltaStuckTicks: previous ? row.stuckTicks - previous.stuckTicks : null,
      deltaMeleeSlotWaitTicks: previous ? row.meleeSlotWaitTicks - previous.meleeSlotWaitTicks : null,
    }
  })
}

function printCompareTable(rows: BaselineCompareRow[]): void {
  console.table(rows.map(row => ({
    preset: row.preset,
    ticks: row.ticks,
    dTicks: formatNullable(row.deltaTicks),
    avgRatio: format(row.averageOverlapRatio),
    dAvgRatio: formatNullable(row.deltaAverageOverlapRatio),
    severe: row.severeOverlapSamples,
    dSevere: formatNullable(row.deltaSevereOverlapSamples),
    switches: row.targetSwitches,
    dSwitches: formatNullable(row.deltaTargetSwitches),
    stuck: row.stuckTicks,
    dStuck: formatNullable(row.deltaStuckTicks),
    meleeWait: row.meleeSlotWaitTicks,
    dMeleeWait: formatNullable(row.deltaMeleeSlotWaitTicks),
  })))
}

function formatNullable(value: number | null): string {
  if (value === null) return 'n/a'
  if (Number.isInteger(value)) return value > 0 ? `+${value}` : String(value)
  const formatted = value.toFixed(4)
  return value > 0 ? `+${formatted}` : formatted
}

function normalizeDelta(value: number): number {
  return Math.abs(value) < 0.00005 ? 0 : value
}

main()
