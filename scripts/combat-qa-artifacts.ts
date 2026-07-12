import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getSimulatorPreset, SIMULATOR_PRESET_OPTIONS } from '@/app/simulator2/simulator.presets'
import { buildBattleReplayMetrics } from '@/components/game/battle-replay-metrics'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { BattleAction, BattleResult, UnitRow } from '@/domains/combat/combat.types'

interface ArtifactMetricsRow {
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

interface ArtifactCompareRow extends ArtifactMetricsRow {
  deltaTicks: number | null
  deltaAverageOverlapRatio: number | null
  deltaSevereOverlapSamples: number | null
  deltaTargetSwitches: number | null
  deltaStuckTicks: number | null
  deltaMeleeSlotWaitTicks: number | null
}

interface ArtifactScenario {
  presetId: string
  result: BattleResult
}

const DEFAULT_PRESETS = ['ranged_duel', 'massive_clash', 'zerg_rush'] as const
const DEFAULT_BASELINE = 'docs/combat-metrics-baseline.json'
const DEFAULT_OUTPUT_DIR = 'artifacts/combat-qa'
const ACTION_SAMPLE_LIMIT = 120

function main(): void {
  const args = process.argv.slice(2)
  const outputDir = resolve(getArgValue(args, '--out=') ?? DEFAULT_OUTPUT_DIR)
  const baselinePath = getArgValue(args, '--baseline=') ?? DEFAULT_BASELINE
  const presets = getRequestedPresets(args)
  const scenarios = presets.map(presetId => ({ presetId, result: simulatePreset(presetId) }))
  const metrics = scenarios.map(buildMetricsRow)
  const compare = compareRows(metrics, readBaseline(baselinePath))

  mkdirSync(outputDir, { recursive: true })
  writeJson(`${outputDir}/metrics.json`, metrics)
  writeJson(`${outputDir}/metrics-compare.json`, compare)
  writeJson(`${outputDir}/replay-action-samples.json`, buildActionSamples(scenarios))
  writeFileSync(`${outputDir}/summary.md`, buildSummary(compare))
  console.log(`Combat QA artifacts written to ${outputDir}`)
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

function buildMetricsRow(scenario: ArtifactScenario): ArtifactMetricsRow {
  const { presetId, result } = scenario
  const metrics = result.metrics
  if (!metrics) throw new Error('Missing combat metrics')
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

function readBaseline(path: string): ArtifactMetricsRow[] {
  const resolved = resolve(path)
  if (!existsSync(resolved)) throw new Error(`Missing baseline file: ${resolved}`)
  return JSON.parse(readFileSync(resolved, 'utf8')) as ArtifactMetricsRow[]
}

function compareRows(rows: ArtifactMetricsRow[], baseline: ArtifactMetricsRow[]): ArtifactCompareRow[] {
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

function buildActionSamples(scenarios: ArtifactScenario[]): Record<string, BattleAction[]> {
  const samples: Record<string, BattleAction[]> = {}
  for (const scenario of scenarios) samples[scenario.presetId] = scenario.result.logs.flatMap(log => log.actions).slice(0, ACTION_SAMPLE_LIMIT)
  return samples
}

function buildSummary(rows: ArtifactCompareRow[]): string {
  const lines = ['# Combat QA Artifacts', '', '| Preset | Ticks | Avg Ratio | Severe | Switches | Stuck | Melee Wait |', '|---|---:|---:|---:|---:|---:|---:|']
  for (const row of rows) {
    lines.push(`| ${row.preset} | ${row.ticks} (${formatDelta(row.deltaTicks)}) | ${format(row.averageOverlapRatio)} (${formatDelta(row.deltaAverageOverlapRatio)}) | ${row.severeOverlapSamples} (${formatDelta(row.deltaSevereOverlapSamples)}) | ${row.targetSwitches} (${formatDelta(row.deltaTargetSwitches)}) | ${row.stuckTicks} (${formatDelta(row.deltaStuckTicks)}) | ${row.meleeSlotWaitTicks} (${formatDelta(row.deltaMeleeSlotWaitTicks)}) |`)
  }
  lines.push('', `Replay action samples are capped at ${ACTION_SAMPLE_LIMIT} actions per preset.`)
  return `${lines.join('\n')}\n`
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((total, value) => total + value, 0)
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function format(value: number): string {
  return value.toFixed(4)
}

function formatDelta(value: number | null): string {
  if (value === null) return 'n/a'
  if (Number.isInteger(value)) return value > 0 ? `+${value}` : String(value)
  const formatted = value.toFixed(4)
  return value > 0 ? `+${formatted}` : formatted
}

function normalizeDelta(value: number): number {
  return Math.abs(value) < 0.00005 ? 0 : value
}

main()
