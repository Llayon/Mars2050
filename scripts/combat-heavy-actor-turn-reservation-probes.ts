import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { applyOrderingProbe } from '@/__tests__/helpers/combat-ordering-probes'
import { captureMovementPipelineCell } from '@/__tests__/helpers/combat-movement-pipeline-probes'
import {
  assertActorTurnMapping,
  compareActorTurnCells,
  prepareActorTurn,
  runCounterfactual,
  runDefaultActorTurnCell,
} from '@/__tests__/helpers/combat-actor-turn-reservation-probes'
import { canonicalSerialize } from '@/__tests__/helpers/combat-semantic-state-diff'
import type { ActorTurnCell, ActorTurnComparison, CounterfactualResult } from '@/__tests__/helpers/combat-actor-turn-reservation-types'

const PRIMARY_SCENARIO = 'tier1_heavy_gunner_sustained_line'
const CERTIFIED_SEEDS = [101, 202, 303, 404, 505]

interface ScenarioRun {
  baseline: ActorTurnCell
  candidate: ActorTurnCell
  comparison: ActorTurnComparison
  counterfactual?: CounterfactualResult
}

function runScenario(scenarioId: string, seed: number, includeCounterfactual: boolean): ScenarioRun {
  const scenario = getScenario(scenarioId)
  const baselineProbe = applyOrderingProbe(scenario, 'baseline')
  const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
  assertActorTurnMapping(
    prepareActorTurn(scenario, seed, baselineProbe),
    prepareActorTurn(scenario, seed, candidateProbe),
  )
  const baselinePr12 = captureMovementPipelineCell(scenario, seed, 'BB', baselineProbe, 1).stage0
  const candidatePr12 = captureMovementPipelineCell(scenario, seed, 'CC', candidateProbe, 1).stage0
  const baseline = runDefaultActorTurnCell(scenario, seed, baselineProbe, 'BP', baselinePr12)
  const candidate = runDefaultActorTurnCell(scenario, seed, candidateProbe, 'CP', candidatePr12)
  const comparison = compareActorTurnCells(baseline, candidate)
  return {
    baseline,
    candidate,
    comparison,
    ...(includeCounterfactual ? { counterfactual: runCounterfactual(scenario, seed, baselineProbe, candidateProbe, baseline.trace, candidate.trace) } : {}),
  }
}

function buildDiagnostic() {
  const primary = runScenario(PRIMARY_SCENARIO, 101, true)
  assertPrimaryGuards(primary)
  const fiveSeedRepeatability = CERTIFIED_SEEDS.map(seed => {
    const result = runScenario(PRIMARY_SCENARIO, seed, true)
    return {
      seed,
      preActorEquivalent: result.comparison.preActorStateEquivalent,
      preludeEquivalent: result.comparison.preludeEquivalent,
      groupMembershipEquivalent: result.comparison.initiativeGroupMembershipEquivalent,
      groupStructureEquivalent: result.comparison.initiativeGroupStructureEquivalent,
      firstProcessingOrderDivergence: result.comparison.productionOrder,
      firstSectorPrefixDivergence: result.comparison.sectorPrefix,
      firstSemanticActorBehaviorDivergence: result.comparison.semanticActorBehavior,
      firstTargetingDivergence: result.comparison.targetingDivergence,
      firstReservationDivergence: result.comparison.reservationDivergence,
      firstGroupEndpointStateDivergence: result.comparison.groupEndpoint,
      firstPersistentDivergence: result.comparison.persistentDivergence,
      candidateBaselineOrderConverges: result.counterfactual?.candidateBaselineOrderConverges ?? false,
      candidateBaselineOrderTraceConverges: result.counterfactual?.candidateBaselineOrderTraceConverges ?? false,
      idContentTraceEffects: result.counterfactual?.idContentTraceEffects ?? null,
      classification: classify(result.comparison, result.counterfactual),
    }
  })
  const controls = ['tier1_heavy_gunner_exposed', 'tier1_marine_baseline_duel'].map(scenario => {
    const result = runScenario(scenario, 101, false)
    return {
      scenario,
      preActorEquivalent: result.comparison.preActorStateEquivalent,
      preludeEquivalent: result.comparison.preludeEquivalent,
      groupMembershipEquivalent: result.comparison.initiativeGroupMembershipEquivalent,
      groupStructureEquivalent: result.comparison.initiativeGroupStructureEquivalent,
      firstProcessingOrderDivergence: result.comparison.productionOrder,
      firstSectorPrefixDivergence: result.comparison.sectorPrefix,
      firstSemanticActorBehaviorDivergence: result.comparison.semanticActorBehavior,
      firstTargetingDivergence: result.comparison.targetingDivergence,
      firstReservationDivergence: result.comparison.reservationDivergence,
      firstGroupEndpointStateDivergence: result.comparison.groupEndpoint,
      firstPersistentDivergence: result.comparison.persistentDivergence,
      classification: classify(result.comparison),
    }
  })
  return {
    diagnostic: 'combat-heavy-actor-turn-reservation-probes',
    version: 1,
    scenario: PRIMARY_SCENARIO,
    primarySeed: 101,
    certifiedSeeds: CERTIFIED_SEEDS,
    productionTrace: {
      baseline: primary.baseline.trace,
      candidate: primary.candidate.trace,
      comparison: primary.comparison,
    },
    counterfactual: primary.counterfactual,
    fiveSeedRepeatability,
    controls,
    classification: classify(primary.comparison, primary.counterfactual),
  }
}

function assertPrimaryGuards(result: ScenarioRun): void {
  if (!result.baseline.endpointEquivalentToProduction || !result.candidate.endpointEquivalentToProduction) throw new Error('ACTOR_TURN_HARNESS_EQUIVALENCE_FAILED')
  if (!result.baseline.endpointEquivalentToPr12 || !result.candidate.endpointEquivalentToPr12) throw new Error('PR12_ENDPOINT_REPRODUCTION_FAILED')
  if (!result.comparison.preActorStateEquivalent) throw new Error('PR12_PRE_ACTOR_CHECKPOINT_REPRODUCTION_FAILED')
}

function classify(comparison: ActorTurnComparison, counterfactual?: CounterfactualResult): string {
  if (!comparison.preActorStateEquivalent || !comparison.preludeEquivalent) return 'ACTOR_TURN_PRELUDE_DIVERGENCE'
  if (!comparison.initiativeGroupMembershipEquivalent) return 'INITIATIVE_GROUP_MEMBERSHIP_DIVERGENCE'
  if (!comparison.productionOrder && !comparison.semanticActorBehavior) return 'NO_DIVERGENCE'
  if (!comparison.productionOrder) {
    if (comparison.semanticActorBehavior?.field.startsWith('targeting.semanticTarget')) return 'TARGET_SELECTION_DIVERGENCE'
    if (comparison.semanticActorBehavior?.field.startsWith('reservation.')) return 'RESERVATION_DIVERGENCE'
    return 'MELEE_SECTOR_STATE_DIVERGENCE'
  }
  const behavior = comparison.semanticActorBehavior
  const converges = counterfactual?.candidateBaselineOrderTraceConverges === true
  const fullReservationChain = converges &&
    behavior?.field === 'before.meleeSectors' &&
    comparison.sectorPrefix !== null &&
    comparison.targetingDivergence !== null &&
    comparison.reservationDivergence !== null &&
    comparison.groupEndpoint !== null &&
    comparison.persistentDivergence !== null
  if (fullReservationChain) return 'SEQUENTIAL_MELEE_RESERVATION_SUPPORTED'
  if (converges) return 'ACTOR_PROCESSING_ORDER_SUPPORTED'
  if (behavior) return 'ORDER_AND_ID_COUPLED'
  return 'PROCESSING_ORDER_DIVERGENCE_ONLY'
}

function getScenario(id: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!scenario) throw new Error(`Missing actor-turn scenario: ${id}`)
  return scenario
}

function printHuman(result: ReturnType<typeof buildDiagnostic>): void {
  const comparison = result.productionTrace.comparison
  const order = comparison.productionOrder
  const behavior = comparison.semanticActorBehavior
  console.log(`Heavy sustained seed ${result.primarySeed}`)
  console.log(`pre-actor: ${comparison.preActorStateEquivalent ? 'SAME' : 'DIFFERENT'}`)
  console.log(`prelude: ${comparison.preludeEquivalent ? 'SAME' : 'DIFFERENT'}`)
  console.log(`first processing order divergence: ${order ? `${order.groupOrdinal}/${order.processingOrdinal} ${order.baselineSemanticActor} -> ${order.candidateSemanticActor}` : 'NONE'}`)
  console.log(`first sector-prefix divergence: ${comparison.sectorPrefix ? `${comparison.sectorPrefix.groupOrdinal}/${comparison.sectorPrefix.processingOrdinal} ${comparison.sectorPrefix.stage} ${comparison.sectorPrefix.baselineSemanticActor} -> ${comparison.sectorPrefix.candidateSemanticActor}` : 'NONE'}`)
  console.log(`first semantic actor behavior divergence: ${behavior ? `${behavior.semanticActor} ${behavior.field}` : 'NONE'}`)
  console.log(`first targeting divergence: ${comparison.targetingDivergence ? `${comparison.targetingDivergence.semanticActor} ${comparison.targetingDivergence.field}` : 'NONE'}`)
  console.log(`first reservation divergence: ${comparison.reservationDivergence ? `${comparison.reservationDivergence.semanticActor} ${comparison.reservationDivergence.field}` : 'NONE'}`)
  console.log(`first group endpoint divergence: ${comparison.groupEndpoint?.groupOrdinal ?? 'NONE'}`)
  console.log(`first persistent divergence: ${comparison.persistentDivergence?.semanticActor ?? 'NONE'}`)
  console.log(`counterfactual candidate + baseline order endpoint: ${result.counterfactual?.candidateBaselineOrderConverges ? 'CONVERGED' : 'DIVERGED'}`)
  console.log(`counterfactual candidate + baseline order trace: ${result.counterfactual?.candidateBaselineOrderTraceConverges ? 'CONVERGED' : 'DIVERGED'}`)
  console.log(`classification: ${result.classification}`)
  console.log('five-seed repeatability:')
  for (const seed of result.fiveSeedRepeatability) console.log(`  ${seed.seed}: ${seed.classification}`)
}

const result = buildDiagnostic()
if (process.argv.includes('--json')) console.log(canonicalSerialize(result))
else printHuman(result)
