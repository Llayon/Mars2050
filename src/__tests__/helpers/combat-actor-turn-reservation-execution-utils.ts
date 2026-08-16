import type { BattleAction } from '@/domains/combat/combat.actions'
import { EcsActionGroupLedger, type EcsActionIntent } from '@/domains/combat/combat.action-intent'
import type { CombatWorld } from '@/domains/combat/ecs/combat-world'
import type { EntityId } from '@/domains/combat/ecs/entity'
import type { MovementRequest } from '@/domains/combat/ecs/movement-batch.types'
import { compareExternalIdsForMode } from '@/domains/combat/ecs/authored-order'
import { captureSemanticStateSnapshot } from './combat-semantic-state-diff'
import { normalizeCommittedActions } from './combat-movement-pipeline-diagnostics'
import type { OrderingProbeResult } from './combat-ordering-probes'
import type { ActorStateView, ActorTraceRecord, PreludeBoundary, SemanticSector } from './combat-actor-turn-reservation-types'
import { captureLedgerFrameGuard, ledgerDelta, projectLedger } from './combat-actor-turn-ledger-projection'
import type { DiagnosticRecord, IntentExecutionRecord, IntentGroupTrace, IntentPlanningCheckpoint, SemanticIntentKey } from './combat-actor-turn-intent-order-types'
import type { PreparedWorld } from './combat-movement-pipeline-advancement'
import type { ActorTurnOrderOverride, ActorTurnReplayOverrides } from './combat-actor-turn-intent-order-types'
import { compareCodeUnit, describeMovementRequest, getActionKind, getSlot, getTarget, semanticId } from './combat-actor-turn-reservation-utils'

export function normalizeReplayOptions(options: ActorTurnReplayOverrides | ActorTurnOrderOverride | undefined): ActorTurnReplayOverrides {
  if (!options) return {}
  return 'groups' in options ? { actorOrder: options } : options
}

export function describeIntentKey(world: CombatWorld, intent: EcsActionIntent, probe: OrderingProbeResult): SemanticIntentKey {
  return { semanticActor: semanticId(world, intent.actorId, probe), semanticTarget: semanticId(world, intent.targetId, probe), kind: intent.kind, originalSequence: intent.sequence }
}

export function applyIntentOrderOverride(world: CombatWorld, sortedIntents: readonly EcsActionIntent[], override: readonly SemanticIntentKey[] | undefined, probe: OrderingProbeResult): EcsActionIntent[] {
  if (!override) return [...sortedIntents]
  const byKey = new Map(sortedIntents.map(intent => [intentKey(describeIntentKey(world, intent, probe)), intent]))
  if (byKey.size !== sortedIntents.length || override.length !== sortedIntents.length || new Set(override.map(intentKey)).size !== override.length || override.some(key => !byKey.has(intentKey(key)))) throw new Error('INTENT_EXECUTION_ORDER_COUNTERFACTUAL_CONTAMINATED')
  return override.map(key => byKey.get(intentKey(key))!)
}

export function captureIntentPlanningCheckpoint(world: CombatWorld, runtime: PreparedWorld['runtime'], probe: OrderingProbeResult, groupOrdinal: number, melee: { sectors: Map<EntityId, number> }, speed: number, entityIds: readonly EntityId[], groupMovement: readonly MovementRequest[], intents: readonly EcsActionIntent[], sortedIntents: readonly EcsActionIntent[], ledger: EcsActionGroupLedger): IntentPlanningCheckpoint {
  return {
    groupOrdinal, speed,
    semanticActorTraversal: entityIds.map(entityId => semanticId(world, entityId, probe)),
    preIntentPersistentState: captureSemanticStateSnapshot(runtime, probe),
    semanticMeleeSectors: captureSectors(world, melee, probe).map(item => ({ ...item })),
    preIntentMovementRequests: groupMovement.map(request => describeMovementRequest(world, request, probe)),
    unsortedIntents: intents.map(intent => describeIntentKey(world, intent, probe)),
    productionSortedIntents: sortedIntents.map(intent => describeIntentKey(world, intent, probe)),
    semanticIntentMultiset: intents.map(intent => describeIntentKey(world, intent, probe)).sort((left, right) => intentKey(left).localeCompare(intentKey(right))),
    semanticGroupLedgerFrameGuard: captureLedgerFrameGuard(world, ledger, probe),
  }
}

export function createIntentExecutionRecord(world: CombatWorld, runtime: PreparedWorld['runtime'], probe: OrderingProbeResult, groupOrdinal: number, intent: EcsActionIntent, executionOrdinal: number, acted: boolean, periodicActions: DiagnosticRecord[], actionSystemActions: DiagnosticRecord[], ledgerBefore: ReturnType<typeof projectLedger>['semantic'], ledgerAfter: ReturnType<typeof projectLedger>['semantic'], fallback: MovementRequest | null, fallbackMovementRequests: readonly MovementRequest[]): IntentExecutionRecord {
  return {
    groupOrdinal, executionOrdinal,
    intentKey: describeIntentKey(world, intent, probe),
    rawActorExternalId: intent.actorExternalId, rawTargetExternalId: intent.targetExternalId, acted,
    periodicSpawnerActionDelta: periodicActions, actionSystemActionDelta: actionSystemActions,
    normalizedActionDelta: [...periodicActions, ...actionSystemActions],
    semanticLedgerBefore: ledgerBefore, semanticLedgerAfter: ledgerAfter,
    semanticLedgerDelta: ledgerDelta(ledgerBefore, ledgerAfter),
    fallbackMovementRequest: fallback ? describeMovementRequest(world, fallback, probe) : null,
    fallbackMovementRequestPrefix: fallbackMovementRequests.map(request => describeMovementRequest(world, request, probe)),
    persistentSemanticStateAfterIntent: captureSemanticStateSnapshot(runtime, probe),
  }
}

export function createIntentGroupTrace(world: CombatWorld, probe: OrderingProbeResult, groupOrdinal: number, speed: number, planning: IntentPlanningCheckpoint, executionIntents: readonly EcsActionIntent[], records: IntentExecutionRecord[], preIntentMovementRequests: readonly DiagnosticRecord[], fallbackMovementRequests: readonly MovementRequest[], groupMovement: readonly MovementRequest[], endpoint: unknown): IntentGroupTrace {
  return {
    groupOrdinal, speed, planning,
    executionOrder: executionIntents.map(intent => describeIntentKey(world, intent, probe)),
    records, preIntentMovementRequests: [...preIntentMovementRequests],
    fallbackMovementRequests: fallbackMovementRequests.map(request => describeMovementRequest(world, request, probe)),
    combinedGroupMovementRequests: groupMovement.map(request => describeMovementRequest(world, request, probe)),
    groupEndpointBeforePhaseDrain: endpoint, endpoint,
  }
}

export function capturePrelude(label: string, runtime: PreparedWorld['runtime'], probe: OrderingProbeResult, actions: readonly BattleAction[], actionStart: number, movementRequestCount: number): PreludeBoundary {
  return { label, state: captureSemanticStateSnapshot(runtime, probe), actions: normalizeCommittedActions(actions.slice(actionStart), probe), movementRequestCount }
}

export function createActorRecord(groupOrdinal: number, speed: number, processingOrdinal: number, world: CombatWorld, entityId: EntityId, probe: OrderingProbeResult, before: ActorStateView, beforeSectors: SemanticSector[], targeting: { state: ActorStateView; semanticTarget: string | null; sectors: SemanticSector[] } | null, attempted: boolean, succeeded: boolean | null, reservation: { state: ActorStateView; semanticTarget: string | null; slot: number | null; waitingTarget: string | null; sectors: SemanticSector[] } | null, melee: { sectors: Map<EntityId, number> }): ActorTraceRecord {
  const current = reservation?.state ?? targeting?.state ?? before
  return {
    groupOrdinal, speed, processingOrdinal, semanticActor: semanticId(world, entityId, probe), productionExternalId: world.stores.identity.require(entityId).id,
    before: { ...before, meleeSectors: beforeSectors },
    targeting: { ...(targeting?.state ?? before), semanticTarget: targeting?.semanticTarget ?? null, meleeSectors: targeting?.sectors ?? captureSectors(world, melee, probe) },
    reservation: { attempted, succeeded, semanticTarget: reservation?.semanticTarget ?? targeting?.semanticTarget ?? null, slot: reservation?.slot ?? getSlot(current), waitingTarget: reservation?.waitingTarget ?? getTarget(current.entityTargets, 'meleeWaitingTarget'), meleeSectors: reservation?.sectors ?? captureSectors(world, melee, probe), state: current },
  }
}

export function captureActorState(runtime: PreparedWorld['runtime'], probe: OrderingProbeResult, entityId: EntityId): ActorStateView {
  const snapshot = captureSemanticStateSnapshot(runtime, probe)
  const actor = snapshot.entities.find(item => item.internalEntityId === entityId)
  if (!actor) throw new Error(`ACTOR_TRACE_ENTITY_MISSING:${entityId}`)
  return { entityTargets: structuredClone(actor.entityTargets), targeting: structuredClone(actor.targeting) }
}

export function captureSectors(world: CombatWorld, melee: { sectors: Map<EntityId, number> }, probe: OrderingProbeResult): SemanticSector[] {
  return [...melee.sectors.entries()].map(([entityId, occupiedMask]) => ({ semanticTarget: semanticId(world, entityId, probe), occupiedMask })).sort((left, right) => compareCodeUnit(left.semanticTarget, right.semanticTarget))
}

export function applyOrderOverride(world: CombatWorld, entityIds: readonly EntityId[], semanticOrder: readonly string[] | undefined, probe: OrderingProbeResult): EntityId[] {
  if (!semanticOrder) return [...entityIds]
  const bySemantic = new Map(entityIds.map(entityId => [semanticId(world, entityId, probe), entityId]))
  if (bySemantic.size !== semanticOrder.length || semanticOrder.some(actor => !bySemantic.has(actor))) throw new Error('ACTOR_ORDER_COUNTERFACTUAL_CONTAMINATED')
  return semanticOrder.map(actor => bySemantic.get(actor)!)
}

export function compareIntents(world: CombatWorld, left: EcsActionIntent, right: EcsActionIntent): number {
  return compareExternalIdsForMode(world, left.kind, right.kind) || compareExternalIdsForMode(world, left.actorExternalId, right.actorExternalId) || compareExternalIdsForMode(world, left.targetExternalId, right.targetExternalId) || left.sequence - right.sequence
}

function intentKey(key: SemanticIntentKey): string {
  return `${key.semanticActor}|${key.semanticTarget}|${key.kind}|${key.originalSequence}`
}
