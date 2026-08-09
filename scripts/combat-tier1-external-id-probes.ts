import type { BattleAction, BattleResult, Team } from '@/domains/combat/combat.types'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { TIER1_BALANCE_SCENARIOS } from '@/domains/combat/combat.tier1-scenarios'
import { TIER1_MATCHUP_SEEDS } from '@/__tests__/helpers/combat-tier1-matchup'
import { runCertifiedProductionCombat } from '@/__tests__/helpers/combat-production-runner'
import {
  applyExternalIdProbe,
  canonicalOrderChanged,
  rawIdStringsChanged,
  semanticUnitKey,
  type ExternalIdProbeResult,
  type ExternalIdProbeTransform,
} from '@/__tests__/helpers/combat-external-id-probes'

type Classification = 'ORDER_ONLY' | 'RAW_ID_DERIVED' | 'RAW_ID_AND_ORDER_COUPLED' | 'NEITHER' | 'UNRESOLVED'

interface ProbeRun {
  seed: number
  transform: ExternalIdProbeTransform
  probe: ExternalIdProbeResult
  result: BattleResult
}

interface Divergence {
  seed: number
  tick: number
  actionIndex: number
  type: string
  category: string
  source: string
  target: string | null
}

interface SchemeDiagnostic {
  transform: ExternalIdProbeTransform
  canonicalOrderChanged: boolean
  rawIdStringsChanged: boolean
  wins: number
  losses: number
  draws: number
  winRate: number
  winnerChanges: number
  targetSemanticChanges: number
  orderedSemanticDivergence: Divergence | null
  canonicalEventSetDivergence: Divergence | null
  firstMovementSemanticDivergence: Divergence | null
}

interface ScenarioDiagnostic {
  scenarioId: string
  name: string
  transforms: SchemeDiagnostic[]
  classification: Classification
}

interface DiagnosticReport {
  scenarios: ScenarioDiagnostic[]
  seeds: readonly number[]
  transformCount: number
  simulationCount: number
}

const TRANSFORMS: readonly ExternalIdProbeTransform[] = [
  'baseline',
  'rank_preserving_a',
  'rank_preserving_b',
  'rank_preserving_c',
  'rank_permuted',
  'full_mirrored_preserve_ids',
  'full_mirrored_rank_preserving_a',
  'full_mirrored_rank_preserving_b',
  'full_mirrored_rank_preserving_c',
  'full_mirrored_legacy',
]

const SCENARIO_IDS = [
  'tier1_grenadier_vs_clump',
  'tier1_heavy_gunner_sustained_line',
  'tier1_marine_baseline_duel',
] as const

let simulationCount = 0
const scenarios = SCENARIO_IDS.map(findScenario).sort((left, right) => compareCodeUnit(left.id, right.id))
const report: DiagnosticReport = {
  scenarios: scenarios.map(evaluateScenario),
  seeds: TIER1_MATCHUP_SEEDS,
  transformCount: TRANSFORMS.length,
  simulationCount,
}
const expectedSimulations = scenarios.length * TIER1_MATCHUP_SEEDS.length * TRANSFORMS.length
if (report.simulationCount !== expectedSimulations) {
  throw new Error(`Expected ${expectedSimulations} simulations, received ${report.simulationCount}`)
}

if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
else process.stdout.write(renderHuman(report))

function evaluateScenario(scenario: CombatBalanceScenario): ScenarioDiagnostic {
  const runs = TRANSFORMS.flatMap(transform => TIER1_MATCHUP_SEEDS.map(seed => runProbe(scenario, seed, transform)))
  const diagnostics = TRANSFORMS.map(transform => summarizeTransform(transform, runs))
  return {
    scenarioId: scenario.id,
    name: scenario.name,
    transforms: diagnostics,
    classification: classifyDiagnostics(diagnostics),
  }
}

function runProbe(scenario: CombatBalanceScenario, seed: number, transform: ExternalIdProbeTransform): ProbeRun {
  const probe = applyExternalIdProbe(scenario, transform)
  simulationCount++
  return {
    seed,
    transform,
    probe,
    result: runCertifiedProductionCombat(probe.attackers, probe.defenders, seed, []),
  }
}

function summarizeTransform(transform: ExternalIdProbeTransform, runs: readonly ProbeRun[]): SchemeDiagnostic {
  const transformRuns = runs.filter(run => run.transform === transform)
  const referenceTransform = transform.startsWith('full_mirrored_') && transform !== 'full_mirrored_preserve_ids'
    ? 'full_mirrored_preserve_ids'
    : 'baseline'
  const referenceRuns = runs.filter(run => run.transform === referenceTransform)
  const referenceProbe = referenceRuns[0]?.probe
  const counts = { wins: 0, losses: 0, draws: 0 }
  let winnerChanges = 0
  let targetSemanticChanges = 0
  let orderedSemanticDivergence: Divergence | null = null
  let canonicalEventSetDivergence: Divergence | null = null
  let firstMovementSemanticDivergence: Divergence | null = null

  for (const run of transformRuns) {
    const reference = referenceRuns.find(item => item.seed === run.seed)
    if (!reference) throw new Error(`Missing ${referenceTransform} reference for ${run.seed}`)
    const outcome = classifyWinner(run.result.winner, run.probe.roleTeam)
    counts[outcome]++
    if (classifyWinner(run.result.winner, run.probe.roleTeam) !== classifyWinner(reference.result.winner, reference.probe.roleTeam)) winnerChanges++
    if (hasTargetSemanticDifference(reference, run)) targetSemanticChanges++
    orderedSemanticDivergence = earliestDivergence(orderedSemanticDivergence, firstOrderedDivergence(reference, run))
    canonicalEventSetDivergence = earliestDivergence(canonicalEventSetDivergence, firstCanonicalDivergence(reference, run))
    firstMovementSemanticDivergence = earliestDivergence(firstMovementSemanticDivergence, firstCategoryDivergence(reference, run, 'movement'))
  }

  const orderReference = referenceProbe
  if (!orderReference) throw new Error(`Missing reference probe for ${transform}`)
  return {
    transform,
    canonicalOrderChanged: canonicalOrderChanged(orderReference, transformRuns[0].probe),
    rawIdStringsChanged: rawIdStringsChanged(orderReference, transformRuns[0].probe),
    ...counts,
    winRate: counts.wins / transformRuns.length,
    winnerChanges,
    targetSemanticChanges,
    orderedSemanticDivergence,
    canonicalEventSetDivergence,
    firstMovementSemanticDivergence,
  }
}

function classifyDiagnostics(items: readonly SchemeDiagnostic[]): Classification {
  const orderChanged = items.find(item => item.transform === 'rank_permuted')?.canonicalOrderChanged === true
  const rankPreserving = items.filter(item => item.transform.includes('rank_preserving_'))
  const rawChangedOutcome = rankPreserving.some(item => item.winnerChanges > 0)
  const rankChangedOutcome = items.find(item => item.transform === 'rank_permuted')?.winnerChanges > 0
  const allExpectedOrderInvariants = rankPreserving.every(item => !item.canonicalOrderChanged)
  if (!allExpectedOrderInvariants || !orderChanged) return 'UNRESOLVED'
  if (rawChangedOutcome && rankChangedOutcome) return 'RAW_ID_AND_ORDER_COUPLED'
  if (rawChangedOutcome) return 'RAW_ID_DERIVED'
  if (rankChangedOutcome) return 'ORDER_ONLY'
  return 'NEITHER'
}

function classifyWinner(winner: BattleResult['winner'], roleTeam: Team): 'wins' | 'losses' | 'draws' {
  if (winner === 'draw') return 'draws'
  return winner === roleTeam ? 'wins' : 'losses'
}

function firstOrderedDivergence(reference: ProbeRun, candidate: ProbeRun): Divergence | null {
  const leftTicks = actualTickMap(reference.result)
  const rightTicks = actualTickMap(candidate.result)
  for (const tick of actualTickNumbers(leftTicks, rightTicks)) {
    const left = leftTicks.get(tick) ?? []
    const right = rightTicks.get(tick) ?? []
    const count = Math.max(left.length, right.length)
    for (let actionIndex = 0; actionIndex < count; actionIndex++) {
      const leftEvent = left[actionIndex] ? normalizeEvent(left[actionIndex], reference.probe) : null
      const rightEvent = right[actionIndex] ? normalizeEvent(right[actionIndex], candidate.probe) : null
      if (leftEvent?.key !== rightEvent?.key) return divergence(candidate.seed, tick, actionIndex, rightEvent ?? leftEvent)
    }
  }
  return null
}

function firstCanonicalDivergence(reference: ProbeRun, candidate: ProbeRun): Divergence | null {
  const leftTicks = actualTickMap(reference.result)
  const rightTicks = actualTickMap(candidate.result)
  for (const tick of actualTickNumbers(leftTicks, rightTicks)) {
    const left = (leftTicks.get(tick) ?? []).map(action => normalizeEvent(action, reference.probe)).sort(compareEvent)
    const right = (rightTicks.get(tick) ?? []).map(action => normalizeEvent(action, candidate.probe)).sort(compareEvent)
    const count = Math.max(left.length, right.length)
    for (let actionIndex = 0; actionIndex < count; actionIndex++) {
      if (left[actionIndex]?.key !== right[actionIndex]?.key) return divergence(candidate.seed, tick, actionIndex, right[actionIndex] ?? left[actionIndex])
    }
  }
  return null
}

function firstCategoryDivergence(reference: ProbeRun, candidate: ProbeRun, category: string): Divergence | null {
  const leftTicks = actualTickMap(reference.result)
  const rightTicks = actualTickMap(candidate.result)
  for (const tick of actualTickNumbers(leftTicks, rightTicks)) {
    const left = (leftTicks.get(tick) ?? [])
      .map(action => normalizeEvent(action, reference.probe))
      .filter(event => event.category === category)
      .sort(compareEvent)
    const right = (rightTicks.get(tick) ?? [])
      .map(action => normalizeEvent(action, candidate.probe))
      .filter(event => event.category === category)
      .sort(compareEvent)
    const count = Math.max(left.length, right.length)
    for (let actionIndex = 0; actionIndex < count; actionIndex++) {
      if (left[actionIndex]?.key !== right[actionIndex]?.key) {
        return divergence(candidate.seed, tick, actionIndex, right[actionIndex] ?? left[actionIndex])
      }
    }
  }
  return null
}

function hasTargetSemanticDifference(reference: ProbeRun, candidate: ProbeRun): boolean {
  const left = targetKeys(reference).sort(compareCodeUnit)
  const right = targetKeys(candidate).sort(compareCodeUnit)
  return JSON.stringify(left) !== JSON.stringify(right)
}

function targetKeys(run: ProbeRun): string[] {
  return [...run.result.logs.flatMap(tick => tick.actions.map(action => `${tick.tick}|${action.type}|${semanticId(action.unitId, run.probe)}|${action.targetId ? semanticId(action.targetId, run.probe) : ''}`))]
}

function normalizeEvent(action: BattleAction, probe: ExternalIdProbeResult): { key: string; type: string; category: string; source: string; target: string | null } {
  const source = semanticId(action.unitId, probe)
  const target = action.targetId === undefined ? null : semanticId(action.targetId, probe)
  return {
    key: JSON.stringify({
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
      sourceTeam: action.sourceTeam === undefined ? undefined : probe.semanticByExternalId.get(action.unitId)?.originalRole ?? action.sourceTeam,
      value: action.value,
      cancelReason: action.cancelReason,
    }),
    type: action.type,
    category: eventCategory(action.type),
    source,
    target,
  }
}

function semanticId(id: string, probe: ExternalIdProbeResult): string {
  const identity = probe.semanticByExternalId.get(id)
  return identity ? semanticUnitKey(identity) : id
}

function eventCategory(type: string): string {
  if (type === 'move' || type === 'knockback' || type === 'teleport') return 'movement'
  if (type === 'damage' || type === 'unit_blocked_damage') return 'damage'
  if (type === 'status_apply' || type === 'target_mark') return 'status'
  if (type === 'attack' || type.endsWith('_attack')) return 'attack'
  if (type === 'die' || type === 'death') return 'death'
  if (type.includes('target')) return 'target'
  return 'other'
}

function divergence(seed: number, tick: number, actionIndex: number, event: { type: string; category: string; source: string; target: string | null } | null): Divergence {
  return {
    seed,
    tick,
    actionIndex,
    type: event?.type ?? 'missing',
    category: event?.category ?? 'other',
    source: event?.source ?? 'missing',
    target: event?.target ?? null,
  }
}

function actualTickMap(result: BattleResult): Map<number, BattleAction[]> {
  return new Map(result.logs.map(item => [item.tick, item.actions]))
}

function actualTickNumbers(...maps: Map<number, BattleAction[]>[]): number[] {
  return [...new Set(maps.flatMap(map => [...map.keys()]))].sort((left, right) => left - right)
}

function compareEvent(left: { key: string }, right: { key: string }): number {
  return compareCodeUnit(left.key, right.key)
}

function earliestDivergence(left: Divergence | null, right: Divergence | null): Divergence | null {
  if (!left) return right
  if (!right) return left
  return compareDivergence(left, right) <= 0 ? left : right
}

function compareDivergence(left: Divergence, right: Divergence): number {
  return left.seed - right.seed || left.tick - right.tick || left.actionIndex - right.actionIndex
}

function renderHuman(report: DiagnosticReport): string {
  const lines = [
    'Tier 1 external-ID ordering versus raw-ID-derived behavior characterization',
    `Scenarios: ${report.scenarios.length} | Seeds: ${report.seeds.join(', ')} | Transforms: ${report.transformCount} | Simulations: ${report.simulationCount}`,
    'All results are diagnostic; no winner outcome is a hard expectation.',
    'Rank-preserving schemes must keep canonical compiled-ID order unchanged.',
    '',
  ]
  for (const scenario of report.scenarios) {
    lines.push(`Scenario: ${scenario.scenarioId} — ${scenario.name}`)
    lines.push('ID scheme | order changed | raw IDs changed | W/L/D | winner changes | target changes | ordered divergence | canonical divergence | first movement')
    for (const item of scenario.transforms) {
      lines.push([
        item.transform,
        item.canonicalOrderChanged ? 'yes' : 'no',
        item.rawIdStringsChanged ? 'yes' : 'no',
        `${item.wins}/${item.losses}/${item.draws}`,
        String(item.winnerChanges),
        String(item.targetSemanticChanges),
        formatDivergence(item.orderedSemanticDivergence),
        formatDivergence(item.canonicalEventSetDivergence),
        formatDivergence(item.firstMovementSemanticDivergence),
      ].join(' | '))
    }
    lines.push(`Classification: ${scenario.classification}`)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

function formatDivergence(value: Divergence | null): string {
  if (!value) return '-'
  return `${value.seed}@${value.tick}:${value.category}:${value.source}->${value.target ?? '-'}`
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function findScenario(id: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!scenario) throw new Error(`Missing required Tier 1 scenario: ${id}`)
  return scenario
}
