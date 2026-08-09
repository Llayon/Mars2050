import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { BattleAction, BattleResult, Team } from '@/domains/combat/combat.types'
import { TIER1_MATCHUP_SEEDS } from '@/__tests__/helpers/combat-tier1-matchup'
import {
  applyOrientationProbe,
  type OrientationProbeResult,
  type OrientationProbeTransform,
  type SemanticUnitIdentity,
} from '@/__tests__/helpers/combat-orientation-probes'
import { runCertifiedProductionCombat } from '@/__tests__/helpers/combat-production-runner'

type Winner = BattleResult['winner']

interface SemanticDivergence {
  seed: number
  tick: number
  actionIndex: number
  type: string
  source: string
  target: string | null
}

interface CanonicalEvent {
  key: string
  type: string
  source: string
  target: string | null
}

interface ProbeRun {
  seed: number
  transform: OrientationProbeTransform
  probe: OrientationProbeResult
  result: BattleResult
}

interface TransformDiagnostic {
  transform: OrientationProbeTransform
  wins: number
  losses: number
  draws: number
  winRate: number
  orderedSemanticDivergence: SemanticDivergence | null
  canonicalEventSetDivergence: SemanticDivergence | null
  targetSemanticChanges: number
  winnerChanges: number
}

interface ScenarioDiagnostic {
  scenarioId: string
  name: string
  transforms: TransformDiagnostic[]
  preliminaryClassification: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
}

interface DiagnosticReport {
  scenarioCount: number
  seeds: readonly number[]
  transformCount: number
  simulationCount: number
  scenarios: ScenarioDiagnostic[]
}

const TRANSFORMS: readonly OrientationProbeTransform[] = [
  'baseline',
  'input_order_reversed',
  'external_id_permuted',
  'center_y_reflected',
  'team_semantics_swapped',
  'full_mirrored_preserve_ids',
  'full_mirrored_legacy',
]

const PRIMARY_SCENARIO_IDS = [
  'tier1_grenadier_vs_clump',
  'tier1_heavy_gunner_sustained_line',
  'tier1_marine_baseline_duel',
] as const

let simulationCount = 0

const scenarios = PRIMARY_SCENARIO_IDS.map(findScenario)
  .sort((left, right) => compareCodeUnit(left.id, right.id))
const diagnostics = scenarios.map(evaluateScenario)
const expectedSimulationCount = scenarios.length * TIER1_MATCHUP_SEEDS.length * TRANSFORMS.length
if (simulationCount !== expectedSimulationCount) {
  throw new Error(`Expected ${expectedSimulationCount} simulations, received ${simulationCount}`)
}

const report: DiagnosticReport = {
  scenarioCount: scenarios.length,
  seeds: TIER1_MATCHUP_SEEDS,
  transformCount: TRANSFORMS.length,
  simulationCount,
  scenarios: diagnostics,
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} else {
  process.stdout.write(renderHuman(report))
}

function evaluateScenario(scenario: CombatBalanceScenario): ScenarioDiagnostic {
  const runs = TIER1_MATCHUP_SEEDS.flatMap(seed => TRANSFORMS.map(transform => runProbe(scenario, seed, transform)))
  const baselineRuns = runs.filter(run => run.transform === 'baseline')
  const transformDiagnostics = TRANSFORMS.map(transform => {
    const transformRuns = runs.filter(run => run.transform === transform)
    return summarizeTransform(transform, transformRuns, baselineRuns)
  })

  return {
    scenarioId: scenario.id,
    name: scenario.name,
    transforms: transformDiagnostics,
    preliminaryClassification: classifyScenario(transformDiagnostics),
  }
}

function runProbe(scenario: CombatBalanceScenario, seed: number, transform: OrientationProbeTransform): ProbeRun {
  const probe = applyOrientationProbe(scenario, transform)
  simulationCount++
  return {
    seed,
    transform,
    probe,
    result: runCertifiedProductionCombat(probe.attackers, probe.defenders, seed, []),
  }
}

function summarizeTransform(
  transform: OrientationProbeTransform,
  runs: ProbeRun[],
  baselineRuns: ProbeRun[],
): TransformDiagnostic {
  const roleTeamBySeed = new Map(baselineRuns.map(run => [run.seed, run.probe.roleTeam]))
  const counts = { wins: 0, losses: 0, draws: 0 }
  let winnerChanges = 0
  let targetSemanticChanges = 0
  let orderedSemanticDivergence: SemanticDivergence | null = null
  let canonicalEventSetDivergence: SemanticDivergence | null = null

  for (const run of runs) {
    const roleTeam = run.probe.roleTeam
    const winner = classifyWinner(run.result.winner, roleTeam)
    counts[winner]++
    const baseline = baselineRuns.find(item => item.seed === run.seed)
    if (!baseline) throw new Error(`Missing baseline run for seed ${run.seed}`)
    if (classifyWinner(run.result.winner, run.probe.roleTeam)
      !== classifyWinner(baseline.result.winner, baseline.probe.roleTeam)) winnerChanges++
    if (hasTargetSemanticDifference(baseline, run)) targetSemanticChanges++

    const ordered = firstOrderedDivergence(baseline, run)
    const canonical = firstCanonicalDivergence(baseline, run)
    orderedSemanticDivergence = earliestDivergence(orderedSemanticDivergence, ordered)
    canonicalEventSetDivergence = earliestDivergence(canonicalEventSetDivergence, canonical)
  }

  if (roleTeamBySeed.size !== baselineRuns.length) throw new Error('Baseline role-team mapping is incomplete')
  return {
    transform,
    ...counts,
    winRate: counts.wins / runs.length,
    orderedSemanticDivergence,
    canonicalEventSetDivergence,
    targetSemanticChanges,
    winnerChanges,
  }
}

function classifyWinner(winner: Winner, roleTeam: Team): 'wins' | 'losses' | 'draws' {
  if (winner === 'draw') return 'draws'
  return winner === roleTeam ? 'wins' : 'losses'
}

function firstOrderedDivergence(baseline: ProbeRun, transformed: ProbeRun): SemanticDivergence | null {
  const baselineTicks = actualTickMap(baseline.result)
  const transformedTicks = actualTickMap(transformed.result)
  for (const tick of actualTickNumbers(baselineTicks, transformedTicks)) {
    const left = baselineTicks.get(tick) ?? []
    const right = transformedTicks.get(tick) ?? []
    const actionCount = Math.max(left.length, right.length)
    for (let actionIndex = 0; actionIndex < actionCount; actionIndex++) {
      const leftEvent = left[actionIndex] === undefined ? null : normalizeSemanticEvent(left[actionIndex], baseline.probe.semanticByExternalId)
      const rightEvent = right[actionIndex] === undefined ? null : normalizeSemanticEvent(right[actionIndex], transformed.probe.semanticByExternalId)
      if (leftEvent?.key !== rightEvent?.key) {
        return divergenceFromEvent(transformed.seed, tick, actionIndex, rightEvent ?? leftEvent)
      }
    }
  }
  return null
}

function firstCanonicalDivergence(baseline: ProbeRun, transformed: ProbeRun): SemanticDivergence | null {
  const baselineTicks = actualTickMap(baseline.result)
  const transformedTicks = actualTickMap(transformed.result)
  for (const tick of actualTickNumbers(baselineTicks, transformedTicks)) {
    const left = (baselineTicks.get(tick) ?? [])
      .map(action => normalizeSemanticEvent(action, baseline.probe.semanticByExternalId))
      .sort((a, b) => compareCodeUnit(a.key, b.key))
    const right = (transformedTicks.get(tick) ?? [])
      .map(action => normalizeSemanticEvent(action, transformed.probe.semanticByExternalId))
      .sort((a, b) => compareCodeUnit(a.key, b.key))
    const actionCount = Math.max(left.length, right.length)
    for (let actionIndex = 0; actionIndex < actionCount; actionIndex++) {
      if (left[actionIndex]?.key !== right[actionIndex]?.key) {
        return divergenceFromEvent(transformed.seed, tick, actionIndex, right[actionIndex] ?? left[actionIndex])
      }
    }
  }
  return null
}

function actualTickMap(result: BattleResult): Map<number, BattleAction[]> {
  return new Map(result.logs.map(item => [item.tick, item.actions]))
}

function actualTickNumbers(...maps: Map<number, BattleAction[]>[]): number[] {
  return [...new Set(maps.flatMap(map => [...map.keys()]))].sort((left, right) => left - right)
}

function normalizeSemanticEvent(
  action: BattleAction,
  mapping: ReadonlyMap<string, SemanticUnitIdentity>,
): CanonicalEvent {
  const source = normalizeExternalId(action.unitId, mapping)
  const target = action.targetId === undefined ? null : normalizeExternalId(action.targetId, mapping)
  return {
    key: semanticActionKey(action, mapping),
    type: action.type,
    source,
    target,
  }
}

function semanticActionKey(action: BattleAction, mapping: ReadonlyMap<string, SemanticUnitIdentity>): string {
  const source = normalizeExternalId(action.unitId, mapping)
  const target = action.targetId === undefined ? null : normalizeExternalId(action.targetId, mapping)
  const sourceTeam = action.sourceTeam === undefined ? undefined : normalizeTeam(action.unitId, action.sourceTeam, mapping)
  return JSON.stringify({
    type: action.type,
    source,
    target,
    damage: action.damage,
    bonusDamage: action.bonusDamage,
    damageKind: action.damageKind,
    statusType: action.statusType,
    cause: action.cause,
    markEvent: action.markEvent,
    sourceUnitType: action.sourceUnitType,
    sourceTeam,
    controlMode: action.controlMode,
    stanceMode: action.stanceMode,
    modeState: action.modeState,
    value: action.value,
    cancelReason: action.cancelReason,
  })
}

function normalizeExternalId(id: string, mapping: ReadonlyMap<string, SemanticUnitIdentity>): string {
  const identity = mapping.get(id)
  return identity === undefined
    ? id
    : `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}`
}

function normalizeTeam(id: string, team: Team, mapping: ReadonlyMap<string, SemanticUnitIdentity>): string {
  return mapping.get(id)?.originalRole ?? team
}

function divergenceFromEvent(seed: number, tick: number, actionIndex: number, event: CanonicalEvent | null | undefined): SemanticDivergence {
  return {
    seed,
    tick,
    actionIndex,
    type: event?.type ?? 'missing',
    source: event?.source ?? 'missing',
    target: event?.target ?? null,
  }
}

function hasTargetSemanticDifference(baseline: ProbeRun, transformed: ProbeRun): boolean {
  const baselineTicks = actualTickMap(baseline.result)
  const transformedTicks = actualTickMap(transformed.result)
  const left = actualTickNumbers(baselineTicks, transformedTicks).flatMap(tick =>
    (baselineTicks.get(tick) ?? []).map(action => targetSemanticKey(tick, action, baseline.probe.semanticByExternalId))).sort(compareCodeUnit)
  const right = actualTickNumbers(baselineTicks, transformedTicks).flatMap(tick =>
    (transformedTicks.get(tick) ?? []).map(action => targetSemanticKey(tick, action, transformed.probe.semanticByExternalId))).sort(compareCodeUnit)
  return JSON.stringify(left) !== JSON.stringify(right)
}

function targetSemanticKey(tick: number, action: BattleAction, mapping: ReadonlyMap<string, SemanticUnitIdentity>): string {
  return `${tick}|${action.type}|${normalizeExternalId(action.unitId, mapping)}|${action.targetId === undefined ? '' : normalizeExternalId(action.targetId, mapping)}`
}

function earliestDivergence(left: SemanticDivergence | null, right: SemanticDivergence | null): SemanticDivergence | null {
  if (left === null) return right
  if (right === null) return left
  return compareDivergence(left, right) <= 0 ? left : right
}

function compareDivergence(left: SemanticDivergence, right: SemanticDivergence): number {
  return left.seed - right.seed || left.tick - right.tick || left.actionIndex - right.actionIndex
}

function classifyScenario(items: readonly TransformDiagnostic[]): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
  const evidence = new Set<'A' | 'B' | 'C' | 'D' | 'E' | 'F'>()
  const baseline = items.find(item => item.transform === 'baseline')
  const hasCanonical = items.some(item => item.canonicalEventSetDivergence !== null)
  const hasOrderedOnly = items.some(item => item.orderedSemanticDivergence !== null && item.canonicalEventSetDivergence === null)
  const external = items.find(item => item.transform === 'external_id_permuted')
  const center = items.find(item => item.transform === 'center_y_reflected')
  const team = items.filter(item => item.transform === 'team_semantics_swapped' || item.transform === 'full_mirrored_preserve_ids' || item.transform === 'full_mirrored_legacy')

  if (hasOrderedOnly) evidence.add('D')
  if (external?.targetSemanticChanges && external.targetSemanticChanges > 0) evidence.add('B')
  if (center?.canonicalEventSetDivergence !== null) evidence.add('C')
  if (team.some(item => item.canonicalEventSetDivergence !== null)
    && center?.canonicalEventSetDivergence === null
    && external?.targetSemanticChanges === 0) evidence.add('F')
  if (baseline && items.some(item => item.winnerChanges > 0 && item.targetSemanticChanges === 0 && item.canonicalEventSetDivergence !== null)) evidence.add('A')

  if (!hasCanonical && !hasOrderedOnly) return 'D'
  if (evidence.size === 1) return [...evidence][0]
  return 'E'
}

function renderHuman(report: DiagnosticReport): string {
  const lines = [
    'Tier 1 orientation and initiative characterization',
    `Scenarios: ${report.scenarioCount} | Seeds: ${report.seeds.join(', ')} | Transforms: ${report.transformCount} | Simulations: ${report.simulationCount}`,
    'All classifications are preliminary; orientation-sensitive does not mean proven spatial side bias.',
    'External-ID-derived semantics are the leading area: canonical ordering/ties and deterministic ID-derived spatial hashing remain separate candidate mechanisms.',
    '',
  ]
  for (const scenario of report.scenarios) {
    lines.push(`Scenario: ${scenario.scenarioId} — ${scenario.name}`)
    lines.push('Transform | W/L/D | Win rate | Ordered divergence | Canonical divergence | Target changes | Winner changes')
    for (const item of scenario.transforms) {
      lines.push([
        item.transform,
        `${item.wins}/${item.losses}/${item.draws}`,
        formatPercent(item.winRate),
        formatDivergence(item.orderedSemanticDivergence),
        formatDivergence(item.canonicalEventSetDivergence),
        String(item.targetSemanticChanges),
        String(item.winnerChanges),
      ].join(' | '))
    }
    lines.push(`Preliminary classification: ${scenario.preliminaryClassification}`)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

function formatDivergence(value: SemanticDivergence | null): string {
  if (value === null) return 'none'
  return `${value.seed}@${value.tick}:${value.type}:${value.source}->${value.target ?? '-'}`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function findScenario(id: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!scenario) throw new Error(`Missing required Tier 1 scenario: ${id}`)
  return scenario
}
