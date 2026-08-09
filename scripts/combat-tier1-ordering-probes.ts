import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { runCertifiedProductionCombat } from '@/__tests__/helpers/combat-production-runner'
import {
  ORDERING_TRANSFORMS, applyOrderingProbe, compiledIdsForRow,
  type OrderingProbeResult, type OrderingTransform,
} from '@/__tests__/helpers/combat-ordering-probes'
import { compareBattlePairs, comparePlanningPairs, type BattlePairDiagnostics, type OrderingDivergence } from '@/__tests__/helpers/combat-ordering-diagnostics'
import { captureInitialPlanningSnapshot, firstPlanningDivergence, type PlanningDivergence } from '@/__tests__/helpers/combat-ordering-runtime-probes'

const SEEDS = [101, 202, 303, 404, 505] as const
const SCENARIO_IDS = ['tier1_heavy_gunner_exposed', 'tier1_heavy_gunner_sustained_line', 'tier1_marine_baseline_duel'] as const
const scenarios = SCENARIO_IDS.map(findScenario)
const jsonMode = process.argv.includes('--json')
let simulationCount = 0

interface Sample {
  seed: number
  probe: OrderingProbeResult
  result: ReturnType<typeof runCertifiedProductionCombat>
  planning: ReturnType<typeof captureInitialPlanningSnapshot>
}

interface TransformReport {
  transform: OrderingTransform
  rawIdStringsChanged: boolean
  selectedCohortSemanticRankChanged: boolean
  initialSemanticInitiativeOwnershipChanged: boolean
  wins: number
  losses: number
  draws: number
  winnerChanges: number
  behaviorChanges: number
  targetSemanticChanges: number
  reservationOwnershipChanges: number
  firstPlanningDivergence: (PlanningDivergence & { seed: number }) | null
  semanticPlanningDivergence: (PlanningDivergence & { seed: number }) | null
  orderedSemanticDivergence: OrderingDivergence | null
  canonicalEventSetDivergence: OrderingDivergence | null
  firstCommittedMovementDivergence: OrderingDivergence | null
  firstDamageDivergence: OrderingDivergence | null
  firstStatusDivergence: OrderingDivergence | null
  firstDeathDivergence: OrderingDivergence | null
}

interface ScenarioReport {
  scenarioId: string
  name: string
  transforms: TransformReport[]
  behaviorSensitivity: Sensitivity
  outcomeSensitivity: Sensitivity
  residualRawIdContamination: 'CLEAN' | 'DETECTED' | 'UNRESOLVED'
  mechanismAssessment: string
}

type Sensitivity = 'NEITHER' | 'DEFENDER_COHORT_ONLY' | 'ATTACKER_COHORT_ONLY' | 'BOTH_COHORTS' | 'GLOBAL_ONLY' | 'UNRESOLVED'

const reports = scenarios.map(buildScenarioReport)
if (simulationCount !== scenarios.length * SEEDS.length * ORDERING_TRANSFORMS.length) {
  throw new Error(`Expected 105 simulations, received ${simulationCount}`)
}

const output = { scenarioCount: scenarios.length, seeds: SEEDS, transforms: ORDERING_TRANSFORMS, simulationCount, scenarios: reports }
process.stdout.write(jsonMode ? `${JSON.stringify(output, null, 2)}\n` : renderHuman(output))

function buildScenarioReport(scenario: CombatBalanceScenario): ScenarioReport {
  const samples = new Map<OrderingTransform, Sample[]>()
  for (const transform of ORDERING_TRANSFORMS) {
    const probe = applyOrderingProbe(scenario, transform)
    samples.set(transform, SEEDS.map(seed => {
      const planning = captureInitialPlanningSnapshot(probe, seed)
      const result = runCertifiedProductionCombat(probe.attackers, probe.defenders, seed, [])
      simulationCount++
      return { seed, probe, result, planning }
    }))
  }
  const baseline = samples.get('baseline')!
  const transforms = ORDERING_TRANSFORMS.map(transform => summarizeTransform(transform, samples.get(transform)!, baseline))
  const sentinel = transforms.find(item => item.transform === 'rank_preserving_a')!
  return {
    scenarioId: scenario.id,
    name: scenario.name,
    transforms,
    behaviorSensitivity: sensitivity(transforms, 'behaviorChanges'),
    outcomeSensitivity: sensitivity(transforms, 'winnerChanges'),
    residualRawIdContamination: sentinel.behaviorChanges > 0 ? 'DETECTED' : 'CLEAN',
    mechanismAssessment: assessMechanism(transforms, sentinel.behaviorChanges > 0),
  }
}

function summarizeTransform(transform: OrderingTransform, samples: Sample[], baseline: Sample[]): TransformReport {
  const first = samples[0]
  const pairs: BattlePairDiagnostics[] = samples.map((sample, index) => compareBattlePairs(sample.seed, baseline[index], sample))
  const planningPairs = samples.map((sample, index) => comparePlanningPairs(sample.seed, baseline[index].planning, sample.planning, firstPlanningDivergence))
  const winnerChanges = samples.filter((sample, index) => sample.result.winner !== baseline[index].result.winner).length
  const firstPlan = firstBySeed(planningPairs.map(pair => pair.firstPlanningDivergence))
  const firstSemanticPlan = firstBySeed(planningPairs.map(pair => pair.semanticPlanningDivergence))
  const firstOrdered = firstBySeed(pairs.map(pair => pair.orderedSemanticDivergence))
  const firstCanonical = firstBySeed(pairs.map(pair => pair.canonicalEventSetDivergence))
  const firstMovement = firstBySeed(pairs.map(pair => pair.firstCommittedMovementDivergence))
  const firstDamage = firstBySeed(pairs.map(pair => pair.firstDamageDivergence))
  const firstStatus = firstBySeed(pairs.map(pair => pair.firstStatusDivergence))
  const firstDeath = firstBySeed(pairs.map(pair => pair.firstDeathDivergence))
  const rawIdStringsChanged = compiledIdList(baseline[0].probe) !== compiledIdList(first.probe)
  const selectedCohortSemanticRankChanged = transform !== 'baseline' && transform !== 'input_order_reversed' && transform !== 'rank_preserving_a'
  return {
    transform,
    rawIdStringsChanged,
    selectedCohortSemanticRankChanged,
    initialSemanticInitiativeOwnershipChanged: planningPairs.some(pair => pair.processingOrderChanged),
    wins: samples.filter(sample => sample.result.winner === 'attacker').length,
    losses: samples.filter(sample => sample.result.winner === 'defender').length,
    draws: samples.filter(sample => sample.result.winner === 'draw').length,
    winnerChanges,
    behaviorChanges: pairs.filter(pair => pair.meaningfulBehaviorChanged).length,
    targetSemanticChanges: pairs.filter(pair => pair.targetSemanticChanges).length,
    reservationOwnershipChanges: planningPairs.filter(pair => pair.semanticPlanningDivergence !== null && /meleeSlotIndex|semanticWaitingTarget|reservationSucceeded|disposition/.test(pair.semanticPlanningDivergence.field)).length,
    firstPlanningDivergence: firstPlan,
    semanticPlanningDivergence: firstSemanticPlan,
    orderedSemanticDivergence: firstOrdered,
    canonicalEventSetDivergence: firstCanonical,
    firstCommittedMovementDivergence: firstMovement,
    firstDamageDivergence: firstDamage,
    firstStatusDivergence: firstStatus,
    firstDeathDivergence: firstDeath,
  }
}

function assessMechanism(items: TransformReport[], residual: boolean): string {
  if (residual) return 'RESIDUAL_RAW_ID_DERIVED'
  const defender = items.find(item => item.transform === 'defender_cohort_rank_reassigned')
  const attacker = items.find(item => item.transform === 'attacker_cohort_rank_reassigned')
  if (defender?.reservationOwnershipChanges && defender.firstCommittedMovementDivergence) return 'MELEE_RESERVATION_SUPPORTED'
  if (attacker?.semanticPlanningDivergence?.field === 'semanticTarget' && attacker.targetSemanticChanges > 0) return 'TARGET_TIE_SUPPORTED'
  const late = items.find(item => item.canonicalEventSetDivergence && !item.firstCommittedMovementDivergence && !item.semanticPlanningDivergence)
  if (late?.firstDamageDivergence || late?.firstStatusDivergence || late?.firstDeathDivergence) return 'LATE_ORDERING_UNRESOLVED'
  if (items.every(item => item.behaviorChanges === 0)) return 'NO_MEASURED_EFFECT'
  return 'UNRESOLVED'
}

function sensitivity(items: TransformReport[], field: 'behaviorChanges' | 'winnerChanges'): Sensitivity {
  const changed = new Set(items.filter(item => item[field] > 0).map(item => item.transform))
  const attacker = changed.has('attacker_cohort_rank_reassigned')
  const defender = changed.has('defender_cohort_rank_reassigned')
  const both = changed.has('both_cohorts_rank_reassigned')
  if (attacker && defender) return 'BOTH_COHORTS'
  if (attacker) return 'ATTACKER_COHORT_ONLY'
  if (defender) return 'DEFENDER_COHORT_ONLY'
  if (both) return 'UNRESOLVED'
  if (changed.has('global_rank_permuted')) return 'GLOBAL_ONLY'
  return 'UNRESOLVED'
}

function firstBySeed<T extends { seed: number }>(items: (T | null)[]): T | null {
  return items.filter((item): item is T => item !== null).sort((left, right) => left.seed - right.seed)[0] ?? null
}

function compiledIdList(probe: OrderingProbeResult): string {
  return [...probe.attackers, ...probe.defenders].flatMap(compiledIdsForRow).sort(compareCodeUnit).join('|')
}

function findScenario(id: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!scenario) throw new Error(`Missing required ordering scenario ${id}`)
  return scenario
}

function renderHuman(value: { simulationCount: number; scenarios: ScenarioReport[] }): string {
  const lines = [`Tier 1 canonical ordering mechanism isolation | simulations: ${value.simulationCount}`, '']
  for (const scenario of value.scenarios) {
    lines.push(`Scenario: ${scenario.scenarioId}`)
    lines.push('Transform | raw IDs changed | rank changed | initiative ownership changed | W/L/D | winner Δ | behavior Δ | target Δ | actor planning | semantic planning | committed movement | damage | canonical')
    for (const item of scenario.transforms) lines.push([
      item.transform, item.rawIdStringsChanged ? 'yes' : 'no', item.selectedCohortSemanticRankChanged ? 'yes' : 'no', item.initialSemanticInitiativeOwnershipChanged ? 'yes' : 'no',
      `${item.wins}/${item.losses}/${item.draws}`, item.winnerChanges, item.behaviorChanges, item.targetSemanticChanges,
      format(item.firstPlanningDivergence), format(item.semanticPlanningDivergence), format(item.firstCommittedMovementDivergence), format(item.firstDamageDivergence), format(item.canonicalEventSetDivergence),
    ].join(' | '))
    lines.push(`Behavior sensitivity: ${scenario.behaviorSensitivity}`)
    lines.push(`Outcome sensitivity: ${scenario.outcomeSensitivity}`)
    lines.push(`Residual raw-ID contamination: ${scenario.residualRawIdContamination}`)
    lines.push(`Mechanism assessment: ${scenario.mechanismAssessment}`, '')
  }
  return `${lines.join('\n')}\n`
}

function format(value: { seed: number; tick?: number; group?: number; field?: string; category?: string; source?: string; target?: string | null } | null): string {
  if (!value) return '-'
  return 'tick' in value ? `${value.seed}@${value.tick}:${value.category}:${value.source}->${value.target ?? '-'}` : `${value.seed}@g${value.group}:${value.field}`
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
