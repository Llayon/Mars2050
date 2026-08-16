import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { applyOrderingProbe } from '@/__tests__/helpers/combat-ordering-probes'
import { canonicalSerialize } from '@/__tests__/helpers/combat-semantic-state-diff'
import {
  loadPr12Endpoint,
  runIntentOrderExperiment,
  type IntentOrderExperiment,
} from '@/__tests__/helpers/combat-actor-turn-intent-order-probes'

const PRIMARY_SCENARIO = 'tier1_heavy_gunner_sustained_line'
const CERTIFIED_SEEDS = [101, 202, 303, 404, 505]
const CONTROLS = ['tier1_heavy_gunner_exposed', 'tier1_marine_baseline_duel']

interface DiagnosticRun {
  scenario: string
  seed: number
  overall: string
  intentExecutionEffect: string
  fixedOrderIdContentEffect: boolean
  preIntentEquivalent: boolean
  firstProductionIntentOrderDivergence: unknown
  firstExecutionDivergence: unknown
  firstActedResultDivergence: unknown
  firstActionDeltaDivergence: unknown
  firstLedgerDivergence: unknown
  firstFallbackRequestDivergence: unknown
  firstFallbackRequestPrefixDivergence: unknown
  firstPersistentStateDivergenceDuringIntentExecution: unknown
  firstGroup0EndpointDivergence: unknown
  baselineProductionOrder: unknown
  candidateProductionOrder: unknown
  comparisons: IntentOrderExperiment['comparisons']
}

function getScenario(id: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!scenario) throw new Error(`Missing intent-order scenario: ${id}`)
  return scenario
}

function runScenario(scenarioId: string, seed: number): IntentOrderExperiment {
  const scenario = getScenario(scenarioId)
  const baselineProbe = applyOrderingProbe(scenario, 'baseline')
  const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
  return runIntentOrderExperiment(
    scenario,
    seed,
    loadPr12Endpoint(scenario, seed, baselineProbe, 'BB'),
    loadPr12Endpoint(scenario, seed, candidateProbe, 'CC'),
  )
}

function summarize(scenario: string, seed: number, result: IntentOrderExperiment): DiagnosticRun {
  return {
    scenario,
    seed,
    overall: result.overall,
    intentExecutionEffect: result.intentExecutionEffect,
    fixedOrderIdContentEffect: result.fixedOrderIdContentEffect,
    preIntentEquivalent: result.preIntentEquivalent,
    firstProductionIntentOrderDivergence: result.firstProductionIntentOrderDivergence,
    firstExecutionDivergence: result.firstExecutionDivergence,
    firstActedResultDivergence: result.firstActedResultDivergence,
    firstActionDeltaDivergence: result.firstActionDeltaDivergence,
    firstLedgerDivergence: result.firstLedgerDivergence,
    firstFallbackRequestDivergence: result.firstFallbackRequestDivergence,
    firstFallbackRequestPrefixDivergence: result.firstFallbackRequestPrefixDivergence,
    firstPersistentStateDivergenceDuringIntentExecution: result.firstPersistentStateDivergenceDuringIntentExecution,
    firstGroup0EndpointDivergence: result.firstGroup0EndpointDivergence,
    baselineProductionOrder: result.baselineProductionOrder,
    candidateProductionOrder: result.candidateProductionOrder,
    comparisons: result.comparisons,
  }
}

function buildDiagnostic() {
  const primaryExperiment = runScenario(PRIMARY_SCENARIO, 101)
  const repeatability = CERTIFIED_SEEDS.map(seed => summarize(PRIMARY_SCENARIO, seed, runScenario(PRIMARY_SCENARIO, seed)))
  const controls = CONTROLS.map(scenario => summarize(scenario, 101, runScenario(scenario, 101)))
  return {
    diagnostic: 'combat-heavy-actor-turn-intent-order-probes',
    version: 1,
    baseSha: '9c8e80e112b29722cf97d1c644aebd7aff34e45c',
    scenario: PRIMARY_SCENARIO,
    primarySeed: 101,
    targetTick: 1,
    targetGroup: 0,
    targetSpeed: primaryExperiment.cells[0]?.trace.intentExecution.groups[0]?.speed ?? null,
    productionTrace: {
      baselineDefault: primaryExperiment.baselineDefault.trace,
      candidateDefault: primaryExperiment.candidateDefault.trace,
    },
    preIntent: {
      equivalent: primaryExperiment.preIntentEquivalent,
      baselineIntentOrder: primaryExperiment.baselineProductionOrder,
      candidateIntentOrder: primaryExperiment.candidateProductionOrder,
    },
    cells: primaryExperiment.cells,
    comparisons: primaryExperiment.comparisons,
    firstProductionIntentOrderDivergence: primaryExperiment.firstProductionIntentOrderDivergence,
    firstExecutionDivergence: primaryExperiment.firstExecutionDivergence,
    intentExecutionEffect: primaryExperiment.intentExecutionEffect,
    fixedOrderIdContentEffect: primaryExperiment.fixedOrderIdContentEffect,
    downstreamEffect: 'NOT_TESTED',
    overall: primaryExperiment.overall,
    fiveSeedRepeatability: repeatability,
    controls,
    rng: { invoked: false },
  }
}

const result = buildDiagnostic()
if (process.argv.includes('--json')) console.log(canonicalSerialize(result))
else {
  console.log(`Heavy sustained seed ${result.primarySeed}`)
  console.log(`pre-intent: ${result.preIntent.equivalent ? 'SAME' : 'DIFFERENT'}`)
  console.log(`baseline production intent order: ${result.preIntent.baselineIntentOrder.length} intents`)
  console.log(`candidate production intent order: ${result.preIntent.candidateIntentOrder.length} intents`)
  console.log(`first order divergence: ${result.firstProductionIntentOrderDivergence ? 'PRESENT' : 'NONE'}`)
  console.log(`first execution divergence: ${result.firstExecutionDivergence ? 'PRESENT' : 'NONE'}`)
  console.log(`IntentExecutionEffect: ${result.intentExecutionEffect}`)
  console.log(`FixedOrderIdContentEffect: ${result.fixedOrderIdContentEffect ? 'PRESENT' : 'NONE'}`)
  console.log(`Overall: ${result.overall}`)
  console.log('five-seed repeatability:')
  for (const item of result.fiveSeedRepeatability) console.log(`  ${item.seed}: ${item.overall}`)
}
