import { captureStage0 } from './combat-movement-pipeline-probes'
import { canonicalSerialize, compareSemanticStates } from './combat-semantic-state-diff'
import { prepareActorTurn, runTracedActorTurn } from './combat-actor-turn-reservation-probes'
import { normalizeCommittedActions } from './combat-movement-pipeline-diagnostics'
import { semanticId } from './combat-actor-turn-reservation-utils'
import type { ActorTurnTrace } from './combat-actor-turn-reservation-types'
import type { ActorTurnIntentTrace, DiagnosticRecord, SemanticIntentKey } from './combat-actor-turn-intent-order-types'
import type { OrderingProbeResult } from './combat-ordering-probes'
import type { Stage0Checkpoint } from './combat-movement-pipeline-types'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'

export type DownstreamEffect = 'NOT_ELIGIBLE' | 'NO_STATE_EFFECT' | 'REPLAY_ORDER_ONLY' | 'MOVEMENT_STATE'

export interface DownstreamCell {
  label: 'ICB' | 'ICC'
  actorTurnEndpoint: Stage0Checkpoint
  actorTurnActions: DiagnosticRecord[]
  actedResults: DiagnosticRecord[]
  movementRequests: DiagnosticRecord[]
  batchEndpoint: Stage0Checkpoint
  batchActions: DiagnosticRecord[]
  transforms: DiagnosticRecord[]
  collisionProfile: DiagnosticRecord
  dirtyEntities: string[]
}

export interface DownstreamComparison {
  precondition: {
    actorTurnStateEquivalent: boolean
    actorTurnActionsEquivalent: boolean
    actedEquivalent: boolean
    requestMultisetEquivalent: boolean
    requestSequenceEquivalent: boolean
    requestInitiativeIndexEquivalent: boolean
    requestOnlyDifference: boolean
  }
  collisionEquivalent: boolean
  committedTransformsEquivalent: boolean
  movementStateEquivalent: boolean
  moveActionMultisetEquivalent: boolean
  moveActionSequenceEquivalent: boolean
  effect: DownstreamEffect
  cells: DownstreamCell[]
}

export function runDownstreamExperiment(
  scenario: CombatBalanceScenario,
  seed: number,
  probe: OrderingProbeResult,
  actorOrder: readonly (readonly string[])[],
  baselineIntentOrder: readonly SemanticIntentKey[],
  candidateIntentOrder: readonly SemanticIntentKey[],
): DownstreamComparison {
  const cells = [
    runCell(scenario, seed, probe, 'ICB', actorOrder, baselineIntentOrder),
    runCell(scenario, seed, probe, 'ICC', actorOrder, candidateIntentOrder),
  ]
  const left = cells[0]!
  const right = cells[1]!
  const precondition = comparePrecondition(left, right)
  const collisionEquivalent = canonicalSerialize(left.collisionProfile) === canonicalSerialize(right.collisionProfile)
  const committedTransformsEquivalent = canonicalSerialize(left.transforms) === canonicalSerialize(right.transforms)
  const movementStateEquivalent = compareSemanticStates(left.batchEndpoint, right.batchEndpoint).equivalent
  const moveActionMultisetEquivalent = canonicalSerialize(sortRecords(left.batchActions)) === canonicalSerialize(sortRecords(right.batchActions))
  const moveActionSequenceEquivalent = canonicalSerialize(left.batchActions) === canonicalSerialize(right.batchActions)
  const effect = !precondition.requestOnlyDifference
    ? 'NOT_ELIGIBLE'
    : !collisionEquivalent || !committedTransformsEquivalent || !movementStateEquivalent
      ? 'MOVEMENT_STATE'
      : !moveActionMultisetEquivalent || !moveActionSequenceEquivalent
        ? 'REPLAY_ORDER_ONLY'
        : 'NO_STATE_EFFECT'
  return { precondition, collisionEquivalent, committedTransformsEquivalent, movementStateEquivalent, moveActionMultisetEquivalent, moveActionSequenceEquivalent, effect, cells }
}

function runCell(
  scenario: CombatBalanceScenario,
  seed: number,
  probe: OrderingProbeResult,
  label: 'ICB' | 'ICC',
  actorOrder: readonly (readonly string[])[],
  intentOrder: readonly SemanticIntentKey[],
): DownstreamCell {
  const source = prepareActorTurn(scenario, seed, probe, true)
  const trace = runTracedActorTurn(source, { actorOrder: { groups: actorOrder }, intentExecutionOrder: { groups: [intentOrder] } }) as ActorTurnTrace & { intentExecution: ActorTurnIntentTrace }
  if (!trace.intentExecution) throw new Error('INTENT_TRACE_MISSING')
  const batchActionStart = source.prepared.context.actions.length
  source.prepared.runtime.runPhase('batch_movement', source.prepared.context)
  const world = source.prepared.runtime.world
  const profile = world.resources.require('entitySpatial').getProfile(world)
  const snapshot = captureStage0(source.prepared.runtime, probe)
  const actedResults = trace.intentExecution.groups.flatMap(group => group.records.map(record => ({ intentKey: record.intentKey, acted: record.acted })))
    .sort((left, right) => canonicalSerialize(left.intentKey).localeCompare(canonicalSerialize(right.intentKey)))
  return {
    label,
    actorTurnEndpoint: trace.endpoint,
    actorTurnActions: trace.normalizedActions,
    actedResults,
    movementRequests: trace.movementRequests,
    batchEndpoint: snapshot,
    batchActions: normalizeCommittedActions(source.prepared.context.actions.slice(batchActionStart), probe),
    transforms: snapshot.entities.map(entity => ({ semanticActor: entity.semanticActor, transform: entity.transform })),
    collisionProfile: {
      movementIntentCount: profile.movementIntentCount,
      neighborCandidatePairCount: profile.neighborCandidatePairCount,
      neighborEdgeCount: profile.neighborEdgeCount,
      collisionCandidatePairCount: profile.collisionCandidatePairCount,
      collisionOverlapPairCount: profile.collisionOverlapPairCount,
    },
    dirtyEntities: [...world.resources.require('dirtySpatialEntities')].map(entityId => semanticId(world, entityId, probe)).sort(),
  }
}

function comparePrecondition(left: DownstreamCell, right: DownstreamCell): DownstreamComparison['precondition'] {
  const actorTurnStateEquivalent = compareSemanticStates(left.actorTurnEndpoint, right.actorTurnEndpoint).equivalent
  const actorTurnActionsEquivalent = canonicalSerialize(left.actorTurnActions) === canonicalSerialize(right.actorTurnActions)
  const actedEquivalent = canonicalSerialize(left.actedResults) === canonicalSerialize(right.actedResults)
  const leftRequests = left.movementRequests
  const rightRequests = right.movementRequests
  const requestMultisetEquivalent = canonicalSerialize(sortRecords(leftRequests.map(stripInitiative))) === canonicalSerialize(sortRecords(rightRequests.map(stripInitiative)))
  const requestSequenceEquivalent = canonicalSerialize(leftRequests) === canonicalSerialize(rightRequests)
  const requestInitiativeIndexEquivalent = canonicalSerialize(leftRequests.map(request => request.initiativeIndex)) === canonicalSerialize(rightRequests.map(request => request.initiativeIndex))
  const requestOnlyDifference = actorTurnStateEquivalent && actorTurnActionsEquivalent && actedEquivalent && requestMultisetEquivalent && (!requestSequenceEquivalent || !requestInitiativeIndexEquivalent)
  return { actorTurnStateEquivalent, actorTurnActionsEquivalent, actedEquivalent, requestMultisetEquivalent, requestSequenceEquivalent, requestInitiativeIndexEquivalent, requestOnlyDifference }
}

function stripInitiative(value: DiagnosticRecord): DiagnosticRecord {
  const copy = { ...value }
  delete copy.initiativeIndex
  return copy
}

function sortRecords(values: readonly DiagnosticRecord[]): DiagnosticRecord[] {
  return [...values].sort((left, right) => canonicalSerialize(left).localeCompare(canonicalSerialize(right)))
}
