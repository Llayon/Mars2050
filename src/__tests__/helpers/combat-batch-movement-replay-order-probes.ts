import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { MovementRequest } from '@/domains/combat/ecs/movement-batch.types'
import { captureStage0 } from './combat-movement-pipeline-probes'
import { normalizeCommittedActions } from './combat-movement-pipeline-diagnostics'
import { canonicalSerialize } from './combat-semantic-state-diff'
import { prepareActorTurn, runTracedActorTurn } from './combat-actor-turn-reservation-probes'
import { semanticId } from './combat-actor-turn-reservation-utils'
import type { ActorTurnTrace } from './combat-actor-turn-reservation-types'
import type { OrderingProbeResult } from './combat-ordering-probes'
import type { SemanticIntentKey } from './combat-actor-turn-intent-order-types'
import { compareBatchCells, sortRequests } from './combat-batch-movement-replay-order-comparison'
import type { Batch2x2Experiment, BatchMovementCell, RequestFactor, SemanticMovementRequest } from './combat-batch-movement-replay-order-types'

export function runBatch2x2Experiment(
  scenario: CombatBalanceScenario,
  seed: number,
  candidateProbe: OrderingProbeResult,
  baselineActorOrder: readonly string[],
  baselineIntentOrder: readonly SemanticIntentKey[],
  candidateIntentOrder: readonly SemanticIntentKey[],
  requireReferenceDifference = true,
): Batch2x2Experiment {
  const reference = captureReference(scenario, seed, candidateProbe, [baselineActorOrder], baselineIntentOrder, candidateIntentOrder)
  if (!reference.actorTurnStateEquivalent || !reference.actorTurnActionsEquivalent || !reference.requestContentEquivalent ||
      (requireReferenceDifference && (!reference.requestSequenceDifferent || !reference.initiativeAssignmentDifferent))) throw new Error('PR14_DOWNSTREAM_BASELINE_DRIFT')
  const cells: BatchMovementCell[] = [
    runCell(scenario, seed, candidateProbe, 'RBB', baselineActorOrder, baselineIntentOrder, candidateIntentOrder, 'baseline', 'baseline'),
    runCell(scenario, seed, candidateProbe, 'RBC', baselineActorOrder, baselineIntentOrder, candidateIntentOrder, 'baseline', 'candidate'),
    runCell(scenario, seed, candidateProbe, 'RCB', baselineActorOrder, baselineIntentOrder, candidateIntentOrder, 'candidate', 'baseline'),
    runCell(scenario, seed, candidateProbe, 'RCC', baselineActorOrder, baselineIntentOrder, candidateIntentOrder, 'candidate', 'candidate'),
  ]
  return {
    cells,
    comparisons: {
      fixedBaselineAssignment: compareBatchCells(cells[0]!, cells[2]!),
      fixedCandidateAssignment: compareBatchCells(cells[1]!, cells[3]!),
      fixedBaselineOrder: compareBatchCells(cells[0]!, cells[1]!),
      fixedCandidateOrder: compareBatchCells(cells[2]!, cells[3]!),
    },
    reference: {
      ...reference,
      baselineIntentOrder: [...baselineIntentOrder],
      candidateIntentOrder: [...candidateIntentOrder],
    },
  }
}

function captureReference(
  scenario: CombatBalanceScenario,
  seed: number,
  probe: OrderingProbeResult,
  actorOrder: readonly (readonly string[])[],
  baselineIntentOrder: readonly SemanticIntentKey[],
  candidateIntentOrder: readonly SemanticIntentKey[],
): Batch2x2Experiment['reference'] {
  const baseline = prepareActorTurn(scenario, seed, probe, true)
  const candidate = prepareActorTurn(scenario, seed, probe, true)
  const baselineTrace = runTracedActorTurn(baseline, { actorOrder: { groups: actorOrder }, intentExecutionOrder: { groups: [baselineIntentOrder] } }) as ActorTurnTrace
  const candidateTrace = runTracedActorTurn(candidate, { actorOrder: { groups: actorOrder }, intentExecutionOrder: { groups: [candidateIntentOrder] } }) as ActorTurnTrace
  const left = describeRequests(baseline.prepared.runtime.world.resources.require('movementRequests'), baseline.prepared.runtime.world, probe)
  const right = describeRequests(candidate.prepared.runtime.world.resources.require('movementRequests'), candidate.prepared.runtime.world, probe)
  return {
    actorTurnStateEquivalent: canonicalSerialize(baselineTrace.endpoint) === canonicalSerialize(candidateTrace.endpoint),
    actorTurnActionsEquivalent: canonicalSerialize(baselineTrace.normalizedActions) === canonicalSerialize(candidateTrace.normalizedActions),
    requestContentEquivalent: canonicalSerialize(sortRequests(left)) === canonicalSerialize(sortRequests(right)),
    requestSequenceDifferent: canonicalSerialize(left) !== canonicalSerialize(right),
    initiativeAssignmentDifferent: canonicalSerialize(assignments(left)) !== canonicalSerialize(assignments(right)),
    baselineIntentOrder: [], candidateIntentOrder: [],
  }
}

function runCell(
  scenario: CombatBalanceScenario,
  seed: number,
  probe: OrderingProbeResult,
  label: string,
  actorOrder: readonly string[],
  baselineIntentOrder: readonly SemanticIntentKey[],
  candidateIntentOrder: readonly SemanticIntentKey[],
  requestOrderFactor: RequestFactor,
  assignmentFactor: RequestFactor,
): BatchMovementCell {
  const source = prepareActorTurn(scenario, seed, probe, true)
  const trace = runTracedActorTurn(source, { actorOrder: { groups: [actorOrder] }, intentExecutionOrder: { groups: [baselineIntentOrder] } }) as ActorTurnTrace
  const baseRequests = describeRequests(source.prepared.runtime.world.resources.require('movementRequests'), source.prepared.runtime.world, probe)
  const referenceSource = prepareActorTurn(scenario, seed, probe, true)
  const referenceTrace = runTracedActorTurn(referenceSource, { actorOrder: { groups: [actorOrder] }, intentExecutionOrder: { groups: [candidateIntentOrder] } }) as ActorTurnTrace
  const candidateRequests = describeRequests(referenceSource.prepared.runtime.world.resources.require('movementRequests'), referenceSource.prepared.runtime.world, probe)
  const requestByKey = new Map(baseRequests.map((request, index) => [requestKey(request), source.prepared.runtime.world.resources.require('movementRequests')[index]!]))
  const candidateOrderKeys = candidateRequests.map(request => requestKey(request))
  const baselineOrderKeys = baseRequests.map(request => requestKey(request))
  const assignmentSource = assignmentFactor === 'baseline' ? baseRequests : candidateRequests
  const assignment = new Map(assignmentSource.map(request => [requestKey(request), request.initiativeIndex]))
  const selectedKeys = requestOrderFactor === 'baseline' ? baselineOrderKeys : candidateOrderKeys
  const requests = selectedKeys.map(key => {
    const raw = requestByKey.get(key)
    const initiativeIndex = assignment.get(key)
    if (!raw || initiativeIndex === undefined) throw new Error('PR15_REQUEST_FACTOR_CONTAMINATED')
    return { ...raw, initiativeIndex }
  })
  source.prepared.runtime.world.resources.set('movementRequests', requests)
  const actionStart = source.prepared.context.actions.length
  source.prepared.runtime.runPhase('batch_movement', source.prepared.context)
  const actions = normalizeCommittedActions(source.prepared.context.actions.slice(actionStart), probe)
  const partition = splitActions(actions)
  const endpoint = captureStage0(source.prepared.runtime, probe)
  const world = source.prepared.runtime.world
  const profile = world.resources.require('entitySpatial').getProfile(world)
  const cell: BatchMovementCell = {
    label, requestOrder: requestOrderFactor, assignment: assignmentFactor,
    actorTurnEndpoint: trace.endpoint, actorTurnActions: trace.normalizedActions,
    requests: describeRequests(requests, world, probe), planningActions: partition.planning,
    committedMoveActions: partition.committed, allActions: actions, endpoint,
    transforms: endpoint.entities.map(entity => ({ semanticActor: entity.semanticActor, transform: entity.transform })),
    collisionProfile: {
      movementIntentCount: profile.movementIntentCount, neighborCandidatePairCount: profile.neighborCandidatePairCount,
      neighborEdgeCount: profile.neighborEdgeCount, collisionCandidatePairCount: profile.collisionCandidatePairCount,
      collisionOverlapPairCount: profile.collisionOverlapPairCount,
    },
    dirtyEntities: [...world.resources.require('dirtySpatialEntities')].map(entityId => semanticId(world, entityId, probe)).sort(),
    partitionSupported: partition.supported,
  }
  if (!cell.partitionSupported) throw new Error('BATCH_ACTION_PHASE_PARTITION_UNSUPPORTED')
  if (canonicalSerialize(trace.endpoint) !== canonicalSerialize(referenceTrace.endpoint)) throw new Error('PR15_REFERENCE_WORLD_DRIFT')
  return cell
}

function splitActions(actions: readonly Record<string, unknown>[]): { planning: Record<string, unknown>[]; committed: Record<string, unknown>[]; supported: boolean } {
  const firstMove = actions.findIndex(action => action.type === 'move')
  if (firstMove < 0) return { planning: [...actions], committed: [], supported: true }
  const planning = actions.slice(0, firstMove)
  const committed = actions.slice(firstMove)
  return { planning, committed, supported: !planning.some(action => action.type === 'move') && committed.every(action => action.type === 'move') }
}

function describeRequests(requests: readonly MovementRequest[], world: Parameters<typeof semanticId>[0], probe: OrderingProbeResult): SemanticMovementRequest[] {
  return requests.map(request => request.kind === 'move'
    ? { kind: request.kind, semanticActor: semanticId(world, request.entityId, probe), semanticTarget: semanticId(world, request.targetId, probe), initiativeIndex: request.initiativeIndex }
    : { kind: request.kind, semanticActor: semanticId(world, request.entityId, probe), semanticTarget: null, targetX: request.targetX, targetY: request.targetY, initiativeIndex: request.initiativeIndex })
}

function requestKey(request: SemanticMovementRequest): string {
  return canonicalSerialize({ kind: request.kind, semanticActor: request.semanticActor, semanticTarget: request.semanticTarget, targetX: request.targetX, targetY: request.targetY })
}

function assignments(requests: readonly SemanticMovementRequest[]): unknown[] {
  return requests.map(request => ({ key: requestKey(request), initiativeIndex: request.initiativeIndex }))
    .sort((left, right) => canonicalSerialize(left).localeCompare(canonicalSerialize(right)))
}
