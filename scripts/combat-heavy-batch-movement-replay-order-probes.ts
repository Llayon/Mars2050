import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { applyOrderingProbe } from '@/__tests__/helpers/combat-ordering-probes'
import { canonicalSerialize } from '@/__tests__/helpers/combat-semantic-state-diff'
import { createHash } from 'node:crypto'
import { loadPr12Endpoint, runIntentOrderExperiment } from '@/__tests__/helpers/combat-actor-turn-intent-order-probes'
import { runBatch2x2Experiment } from '@/__tests__/helpers/combat-batch-movement-replay-order-probes'
import type { Batch2x2Experiment } from '@/__tests__/helpers/combat-batch-movement-replay-order-types'

const BASE_SHA = '8ff6fc7b33648e3cc1d08377b48a8a89481cf54b'
const PRIMARY = 'tier1_heavy_gunner_sustained_line'
const SEEDS = [101, 202, 303, 404, 505]
const CONTROLS = ['tier1_heavy_gunner_exposed', 'tier1_marine_baseline_duel']

function scenario(id: string): CombatBalanceScenario {
  const value = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!value) throw new Error(`Missing batch replay scenario: ${id}`)
  return value
}

function runExperiment(id: string, seed: number, strict: boolean): Batch2x2Experiment {
  const value = scenario(id)
  const baselineProbe = applyOrderingProbe(value, 'baseline')
  const candidateProbe = applyOrderingProbe(value, 'defender_cohort_rank_reassigned')
  const intent = runIntentOrderExperiment(
    value,
    seed,
    loadPr12Endpoint(value, seed, baselineProbe, 'BB'),
    loadPr12Endpoint(value, seed, candidateProbe, 'CC'),
  )
  const actorOrder = intent.baselineDefault.trace.groups[0]?.processedOrder ?? []
  return runBatch2x2Experiment(value, seed, candidateProbe, actorOrder, intent.baselineProductionOrder, intent.candidateProductionOrder, strict)
}

function summarize(result: Batch2x2Experiment): Record<string, unknown> {
  const assignmentPairs = [result.comparisons.fixedBaselineOrder, result.comparisons.fixedCandidateOrder]
  const orderPairs = [result.comparisons.fixedBaselineAssignment, result.comparisons.fixedCandidateAssignment]
  const assignmentReplayOnly = assignmentPairs.every(pair => pair.initiativeAssignmentEffect === 'MOVE_REPLAY_ORDER_ONLY')
  const orderReplayOnly = orderPairs.every(pair => pair.requestOrderEffect === 'PLANNING_ACTION_ORDER' || pair.requestOrderEffect === 'NONE') &&
    orderPairs.some(pair => !pair.planningActionSequenceEquivalent || !pair.moveActionSequenceEquivalent)
  const stateEffect = [...assignmentPairs, ...orderPairs].some(pair => pair.initiativeAssignmentEffect === 'STATE_EFFECT' || pair.requestOrderEffect === 'MOVEMENT_STATE')
  return {
    reference: result.reference,
    cells: result.cells.map(compactCell),
    comparisons: result.comparisons,
    requestOrderEffect: orderReplayOnly ? 'PRESENT' : 'NONE',
    initiativeAssignmentEffect: assignmentReplayOnly ? 'MOVE_REPLAY_ORDER_ONLY' : 'NONE',
    overall: stateEffect ? 'MOVEMENT_STATE' : assignmentReplayOnly && !orderReplayOnly ? 'INITIATIVE_ASSIGNMENT_REPLAY_ORDER_ONLY' : assignmentReplayOnly && orderReplayOnly ? 'REQUEST_ORDER_AND_ASSIGNMENT_REPLAY_EFFECT' : 'UNRESOLVED',
  }
}

function compactCell(cell: Batch2x2Experiment['cells'][number]): Record<string, unknown> {
  return {
    label: cell.label,
    requestOrder: cell.requestOrder,
    assignment: cell.assignment,
    requests: cell.requests,
    planningActionCount: cell.planningActions.length,
    planningActionSequenceSha256: sha(cell.planningActions),
    planningActionMultisetSha256: sortedSha(cell.planningActions),
    committedMoveActionCount: cell.committedMoveActions.length,
    committedMoveActionSequenceSha256: sha(cell.committedMoveActions),
    committedMoveActionMultisetSha256: sortedSha(cell.committedMoveActions),
    allActionSequenceSha256: sha(cell.allActions),
    collisionProfile: cell.collisionProfile,
    dirtyEntities: cell.dirtyEntities,
    partitionSupported: cell.partitionSupported,
    actorTurnActionsSha256: sha(cell.actorTurnActions),
    actorTurnEndpointSha256: sha(cell.actorTurnEndpoint),
    endpointSha256: sha(cell.endpoint),
    transformsSha256: sha(cell.transforms),
  }
}

function sha(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value)).digest('hex').toUpperCase()
}

function sortedSha(value: readonly unknown[]): string {
  return sha([...value].sort((left, right) => canonicalSerialize(left).localeCompare(canonicalSerialize(right))))
}

const primary = runExperiment(PRIMARY, 101, true)
const diagnostic = {
  diagnostic: 'combat-heavy-batch-movement-replay-order-probes',
  version: 1,
  baseSha: BASE_SHA,
  scenario: PRIMARY,
  primarySeed: 101,
  targetTick: 1,
  targetGroup: 0,
  primary: summarize(primary),
  repeatability: SEEDS.map(seed => ({ seed, result: summarize(runExperiment(PRIMARY, seed, true)) })),
  controls: CONTROLS.map(id => ({ scenario: id, seed: 101, result: summarize(runExperiment(id, 101, false)) })),
  regression: {
    pr14PostMergeDiagnostic: '24E9E4EA80D1E0DDD521863E0F1DA97891C0AE167B0355EB0409F3B7A3F86747',
    pr13: 'D4F1E58C1830AF7E17161F8F03E69B2B6AAE58C3ECF83675DBADFD8B86FA05FA',
    pr12: 'D99DAAE1D7DBF8B78460EFFBF51A552BA528D7FEE853DBEFD26FA3A4967ED682',
    pr11: '30E7F4941E0ADE8C0AE93755CF207693B5C45FB85CBEEF7E63A5908198E4E7BC',
    pr10: '0028E4F232D386981624D86691997FEB3199925F69280465E1F2185BB45D899E',
    v8: 'EA5248064AC989D157D14BE5CE02DE3F0BF5732156BEAF885D11321983E8D2C3',
    v9: '78D870C400A05AD73F48618BDA9EB3977268383279738FAA6FA68F8FB48594C0',
  },
}

if (process.argv.includes('--sha256')) console.log(sha(diagnostic))
else if (process.argv.includes('--json')) console.log(canonicalSerialize(diagnostic))
else {
  console.log(`Heavy sustained seed ${diagnostic.primarySeed}`)
  console.log(`reference request sequence: ${primary.reference.requestSequenceDifferent ? 'DIFFERENT' : 'SAME'}`)
  console.log(`reference initiative assignment: ${primary.reference.initiativeAssignmentDifferent ? 'DIFFERENT' : 'SAME'}`)
  console.log(`fixed assignment baseline: ${primary.comparisons.fixedBaselineAssignment.requestOrderEffect}`)
  console.log(`fixed assignment candidate: ${primary.comparisons.fixedCandidateAssignment.requestOrderEffect}`)
  console.log(`fixed order baseline: ${primary.comparisons.fixedBaselineOrder.initiativeAssignmentEffect}`)
  console.log(`fixed order candidate: ${primary.comparisons.fixedCandidateOrder.initiativeAssignmentEffect}`)
  console.log(`overall: ${summarize(primary).overall}`)
  console.log('five-seed repeatability:')
  for (const seed of diagnostic.repeatability as Array<{ seed: number; result: { overall: string } }>) console.log(`  ${seed.seed}: ${seed.result.overall}`)
}
