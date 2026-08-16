import type { RuntimePhaseContext } from '@/domains/combat/combat.phase'
import { EcsActionGroupLedger, type EcsActionIntent } from '@/domains/combat/combat.action-intent'
import type { EntityId } from '@/domains/combat/ecs/entity'
import type { MovementRequest } from '@/domains/combat/ecs/movement-batch.types'
import { compareEntityExternalIdsForMode } from '@/domains/combat/ecs/authored-order'
import {
  commitActionGroup,
  createEcsMeleeEngagementState,
  getEcsInitiativeGroups,
  resolveEcsDeath,
  reserveEcsMeleeSlot,
  runActionSystem,
  runEcsPeriodicSpawnerSystem,
  runModifierSystem,
  runTargetingSystem,
} from '@/domains/combat/ecs/systems'
import { captureSemanticStateSnapshot } from './combat-semantic-state-diff'
import { normalizeCommittedActions } from './combat-movement-pipeline-diagnostics'
import type { OrderingProbeResult } from './combat-ordering-probes'
import type { ActorTraceRecord, ActorTurnTrace, InitiativeGroupTrace, PreludeBoundary } from './combat-actor-turn-reservation-types'
import type {
  ActorTurnIntentTrace,
  ActorTurnOrderOverride,
  ActorTurnReplayOverrides,
  DiagnosticRecord,
  IntentExecutionRecord,
  IntentGroupTrace,
  SemanticIntentKey,
} from './combat-actor-turn-intent-order-types'
export type { ActorTurnOrderOverride, ActorTurnReplayOverrides } from './combat-actor-turn-intent-order-types'
import type { PreparedWorld } from './combat-movement-pipeline-advancement'
import {
  canActOnTarget,
  compareCodeUnit,
  describeMovementRequest,
  getActionKind,
  getSlot,
  getTarget,
  semanticId,
} from './combat-actor-turn-reservation-utils'
import { projectLedger } from './combat-actor-turn-ledger-projection'
import {
  applyIntentOrderOverride,
  applyOrderOverride,
  captureActorState,
  captureIntentPlanningCheckpoint,
  capturePrelude,
  captureSectors,
  compareIntents,
  createActorRecord,
  createIntentExecutionRecord,
  createIntentGroupTrace,
  describeIntentKey,
  normalizeReplayOptions,
} from './combat-actor-turn-reservation-execution-utils'
export function replayActorTurn(
  prepared: PreparedWorld & { context: RuntimePhaseContext },
  probe: OrderingProbeResult,
  replayOptions?: ActorTurnReplayOverrides | ActorTurnOrderOverride,
): ActorTurnTrace & { intentExecution?: ActorTurnIntentTrace } {
  const options = normalizeReplayOptions(replayOptions)
  const { runtime, context } = prepared
  const world = runtime.world
  const prelude: PreludeBoundary[] = [{
    label: 'before_actor_turn',
    state: captureSemanticStateSnapshot(runtime, probe),
    actions: [],
    movementRequestCount: 0,
  }]
  const movementRequests: MovementRequest[] = []
  world.resources.set('movementRequests', movementRequests)
  prelude.push(capturePrelude('after_movement_request_reset', runtime, probe, context.actions, context.actions.length, movementRequests.length))
  world.flushStructuralCommands()
  prelude.push(capturePrelude('after_initial_structural_flush', runtime, probe, context.actions, context.actions.length, movementRequests.length))
  world.resources.require('entitySpatial').ensureCurrent(world)
  prelude.push(capturePrelude('after_spatial_ensure', runtime, probe, context.actions, context.actions.length, movementRequests.length))
  const melee = createEcsMeleeEngagementState()
  const targeting = world.resources.require('targetingRuntime')
  const ledger = world.resources.get('actionGroup') ?? new EcsActionGroupLedger()
  world.resources.set('actionGroup', ledger)
  const allActors = [...world.query(['identity', 'vitality', 'combat'])]
    .sort((left, right) => compareEntityExternalIdsForMode(world, left, right))
  const modifierStart = context.actions.length
  for (const entityId of allActors) {
    if (world.stores.vitality.require(entityId).isDead) continue
    runModifierSystem(world, entityId, context.actions, expiredId => {
      resolveEcsDeath(world, expiredId, undefined, context.actions, 'expiration')
    })
  }
  prelude.push(capturePrelude('after_modifier_pass', runtime, probe, context.actions, modifierStart, movementRequests.length))
  world.flushStructuralCommands()
  prelude.push(capturePrelude('after_modifier_flush', runtime, probe, context.actions, modifierStart, movementRequests.length))
  targeting.begin(world)
  prelude.push(capturePrelude('after_targeting_begin', runtime, probe, context.actions, modifierStart, movementRequests.length))
  const groups: InitiativeGroupTrace[] = []; const actors: ActorTraceRecord[] = []
  const intentGroups: IntentGroupTrace[] = []
  const productionSortedIntentOrders: SemanticIntentKey[][] = []
  const initiativeGroups = getEcsInitiativeGroups(world)
  let initiativeIndex = 0
  try {
    for (let groupOrdinal = 0; groupOrdinal < initiativeGroups.length; groupOrdinal++) {
      const sourceGroup = initiativeGroups[groupOrdinal]!
      const entityIds = applyOrderOverride(world, sourceGroup.entityIds, options.actorOrder?.groups[groupOrdinal], probe)
      const productionOrder = sourceGroup.entityIds.map(entityId => semanticId(world, entityId, probe))
      const externalIdOrder = entityIds.map(entityId => world.stores.identity.require(entityId).id)
      ledger.begin(world, world.query(['identity', 'vitality']), {
        tick: context.tick, phaseId: 'actor_turn', groupOrdinal: initiativeIndex,
      })
      const intents: EcsActionIntent[] = []
      const groupMovement: MovementRequest[] = []
      const groupActionStart = context.actions.length
      const groupActorStart = actors.length
      for (const entityId of entityIds) {
        if (world.stores.vitality.require(entityId).isDead) continue
        const actorBefore = captureActorState(runtime, probe, entityId)
        const beforeSectors = captureSectors(world, melee, probe)
        const timeline = world.resources.require('temporalAttacks').get(entityId)
        if (timeline) {
          const target = world.stores.transform.get(timeline.targetId)
          const aim = timeline.positionPolicy === 'captured_at_windup'
            ? { x: timeline.aimX, y: timeline.aimY }
            : target && !world.stores.vitality.require(timeline.targetId).isDead
              ? { x: target.x, y: target.y }
              : { x: timeline.aimX, y: timeline.aimY }
          groupMovement.push({ kind: 'turn', entityId, targetX: aim.x, targetY: aim.y, initiativeIndex: initiativeIndex++ })
          actors.push(createActorRecord(groupOrdinal, sourceGroup.speed, actors.length, world, entityId, probe, actorBefore, beforeSectors, null, false, null, null, melee))
          continue
        }
        const targetId = runTargetingSystem(world, entityId, melee, targeting)
        const targetState = captureActorState(runtime, probe, entityId)
        const targetSectors = captureSectors(world, melee, probe)
        const targetSemantic = targetId === null ? null : semanticId(world, targetId, probe)
        const canAct = targetId !== null && canActOnTarget(world, entityId, targetId)
        const attempted = targetId !== null && canAct
        const engaged = attempted ? reserveEcsMeleeSlot(world, entityId, targetId!, melee) : true
        const reservationState = captureActorState(runtime, probe, entityId)
        const reservationSectors = captureSectors(world, melee, probe)
        actors.push(createActorRecord(groupOrdinal, sourceGroup.speed, actors.length, world, entityId, probe, actorBefore, beforeSectors, {
          state: targetState, semanticTarget: targetSemantic, sectors: targetSectors,
        }, attempted, attempted ? engaged : null, {
          state: reservationState, semanticTarget: targetSemantic,
          slot: getSlot(reservationState), waitingTarget: getTarget(reservationState.entityTargets, 'meleeWaitingTarget'),
          sectors: reservationSectors,
        }, melee))
        if (targetId === null) continue
        if (!canAct || !engaged) {
          groupMovement.push({ kind: 'move', entityId, targetId: targetId!, initiativeIndex: initiativeIndex++ })
          continue
        }
        const actor = world.stores.identity.require(entityId)
        const target = world.stores.identity.require(targetId)
        intents.push({
          actorId: entityId, targetId, initiative: sourceGroup.speed,
          actorExternalId: actor.id, targetExternalId: target.id, team: actor.team,
          kind: getActionKind(world, entityId), sequence: intents.length,
        })
      }
      const unsortedIntentSnapshot = intents.map(intent => describeIntentKey(world, intent, probe))
      const sortedIntents = [...intents].sort((left, right) => compareIntents(world, left, right))
      const productionSortedKeys = sortedIntents.map(intent => describeIntentKey(world, intent, probe))
      productionSortedIntentOrders.push(productionSortedKeys)
      const executionIntents = applyIntentOrderOverride(
        world,
        sortedIntents,
        options.intentExecutionOrder?.groups[groupOrdinal],
        probe,
      )
      const planning = captureIntentPlanningCheckpoint(
        world,
        runtime,
        probe,
        groupOrdinal,
        melee,
        sourceGroup.speed,
        entityIds,
        groupMovement,
        intents,
        sortedIntents,
        ledger,
      )
      options.instrumentation?.onPlanning?.(structuredClone(planning))
      const intentRecords: IntentExecutionRecord[] = []
      const fallbackMovementRequests: MovementRequest[] = []
      for (const [executionOrdinal, intent] of executionIntents.entries()) {
        const ledgerBefore = projectLedger(world, ledger, probe)
        let periodicActions: DiagnosticRecord[] = []
        if (world.stores.periodicSpawnerCapability.has(intent.actorId)) {
          const periodicStart = context.actions.length
          runEcsPeriodicSpawnerSystem(world, intent.actorId, intent.targetId, context.actions, { rng: context.rng ?? world.resources.require('rng'), tick: context.tick })
          periodicActions = normalizeCommittedActions(context.actions.slice(periodicStart), probe)
        }
        const actionSystemStart = context.actions.length
        const acted = runActionSystem(world, intent.actorId, intent.targetId, context.actions, {
          rng: context.rng ?? world.resources.require('rng'), tick: context.tick, allowDeadActorAction: true,
        }).acted
        const actionSystemActions = normalizeCommittedActions(context.actions.slice(actionSystemStart), probe)
        const fallback = acted ? null : { kind: 'move' as const, entityId: intent.actorId, targetId: intent.targetId, initiativeIndex: initiativeIndex++ }
        if (fallback) {
          groupMovement.push(fallback)
          fallbackMovementRequests.push(fallback)
        }
        const ledgerAfter = projectLedger(world, ledger, probe)
        const record = createIntentExecutionRecord(world, runtime, probe, groupOrdinal, intent, executionOrdinal, acted, periodicActions, actionSystemActions, ledgerBefore.semantic, ledgerAfter.semantic, fallback, fallbackMovementRequests)
        intentRecords.push(record)
        options.instrumentation?.onIntent?.(structuredClone(record))
      }
      const preIntentMovementRequests = groupMovement.map(request => describeMovementRequest(world, request, probe))
      movementRequests.push(...groupMovement)
      commitActionGroup(world, ledger, context.actions)
      world.flushStructuralCommands()
      const groupEndpointBeforePhaseDrain = captureSemanticStateSnapshot(runtime, probe)
      groups.push({
        groupOrdinal, speed: sourceGroup.speed,
        semanticMembers: sourceGroup.entityIds.map(entityId => semanticId(world, entityId, probe)).sort(compareCodeUnit),
        productionOrder, processedOrder: entityIds.map(entityId => semanticId(world, entityId, probe)), externalIdOrder,
        actionIntents: sortedIntents.map(intent => ({ semanticActor: semanticId(world, intent.actorId, probe), semanticTarget: semanticId(world, intent.targetId, probe), kind: intent.kind, initiative: intent.initiative, sequence: intent.sequence })),
        movementRequests: groupMovement.map(request => describeMovementRequest(world, request, probe)),
        actions: normalizeCommittedActions(context.actions.slice(groupActionStart), probe),
        endpoint: captureSemanticStateSnapshot(runtime, probe),
      })
      const intentGroup = createIntentGroupTrace(world, probe, groupOrdinal, sourceGroup.speed, { ...planning, unsortedIntents: unsortedIntentSnapshot }, executionIntents, intentRecords, preIntentMovementRequests, fallbackMovementRequests, groupMovement, groupEndpointBeforePhaseDrain)
      intentGroups.push(intentGroup)
      options.instrumentation?.onGroup?.(structuredClone(intentGroup))
      for (const actor of actors.slice(groupActorStart)) actor.groupOrdinal = groupOrdinal
      initiativeIndex += sourceGroup.entityIds.length
      if (options.stopAfterGroupOrdinal === groupOrdinal) break
    }
  } finally {
    targeting.end()
  }
  const trace: ActorTurnTrace & { intentExecution?: ActorTurnIntentTrace } = {
    prelude,
    groups,
    actors,
    endpoint: captureSemanticStateSnapshot(runtime, probe),
    normalizedActions: normalizeCommittedActions(context.actions, probe),
    movementRequests: movementRequests.map(request => describeMovementRequest(world, request, probe)),
    initiativeGroups,
  }
  if (options.intentExecutionOrder || options.instrumentation || options.stopAfterGroupOrdinal !== undefined) {
    trace.intentExecution = {
      groups: intentGroups,
      productionSortedIntentOrders,
      endpoint: trace.endpoint,
      stoppedBeforePhaseDrain: options.stopAfterGroupOrdinal !== undefined,
    }
  }
  return trace
}
