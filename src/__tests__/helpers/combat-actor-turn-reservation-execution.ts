import type { BattleAction } from '@/domains/combat/combat.actions'
import type { RuntimePhaseContext } from '@/domains/combat/combat.phase'
import { EcsActionGroupLedger, type EcsActionIntent } from '@/domains/combat/combat.action-intent'
import type { CombatWorld } from '@/domains/combat/ecs/combat-world'
import type { EntityId } from '@/domains/combat/ecs/entity'
import type { MovementRequest } from '@/domains/combat/ecs/movement-batch.types'
import { compareEntityExternalIdsForMode, compareExternalIdsForMode } from '@/domains/combat/ecs/authored-order'
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
import type {
  ActorStateView,
  ActorTraceRecord,
  ActorTurnTrace,
  InitiativeGroupTrace,
  PreludeBoundary,
  SemanticSector,
} from './combat-actor-turn-reservation-types'
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

export interface ActorTurnOrderOverride {
  readonly groups: readonly (readonly string[])[]
}

export function replayActorTurn(
  prepared: PreparedWorld & { context: RuntimePhaseContext },
  probe: OrderingProbeResult,
  orderOverride?: ActorTurnOrderOverride,
): ActorTurnTrace {
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

  const groups: InitiativeGroupTrace[] = []
  const actors: ActorTraceRecord[] = []
  const initiativeGroups = getEcsInitiativeGroups(world)
  let initiativeIndex = 0
  try {
    for (let groupOrdinal = 0; groupOrdinal < initiativeGroups.length; groupOrdinal++) {
      const sourceGroup = initiativeGroups[groupOrdinal]!
      const entityIds = applyOrderOverride(world, sourceGroup.entityIds, orderOverride?.groups[groupOrdinal], probe)
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
      const sortedIntents = intents.sort((left, right) => compareIntents(world, left, right))
      for (const intent of sortedIntents) {
        if (world.stores.periodicSpawnerCapability.has(intent.actorId)) {
          runEcsPeriodicSpawnerSystem(world, intent.actorId, intent.targetId, context.actions, { rng: context.rng ?? world.resources.require('rng'), tick: context.tick })
        }
        const acted = runActionSystem(world, intent.actorId, intent.targetId, context.actions, {
          rng: context.rng ?? world.resources.require('rng'), tick: context.tick, allowDeadActorAction: true,
        }).acted
        if (!acted) groupMovement.push({ kind: 'move', entityId: intent.actorId, targetId: intent.targetId, initiativeIndex: initiativeIndex++ })
      }
      movementRequests.push(...groupMovement)
      commitActionGroup(world, ledger, context.actions)
      world.flushStructuralCommands()
      groups.push({
        groupOrdinal, speed: sourceGroup.speed,
        semanticMembers: sourceGroup.entityIds.map(entityId => semanticId(world, entityId, probe)).sort(compareCodeUnit),
        productionOrder, processedOrder: entityIds.map(entityId => semanticId(world, entityId, probe)), externalIdOrder,
        actionIntents: sortedIntents.map(intent => ({ semanticActor: semanticId(world, intent.actorId, probe), semanticTarget: semanticId(world, intent.targetId, probe), kind: intent.kind, initiative: intent.initiative, sequence: intent.sequence })),
        movementRequests: groupMovement.map(request => describeMovementRequest(world, request, probe)),
        actions: normalizeCommittedActions(context.actions.slice(groupActionStart), probe),
        endpoint: captureSemanticStateSnapshot(runtime, probe),
      })
      for (const actor of actors.slice(groupActorStart)) actor.groupOrdinal = groupOrdinal
      initiativeIndex += sourceGroup.entityIds.length
    }
  } finally {
    targeting.end()
  }
  return {
    prelude,
    groups,
    actors,
    endpoint: captureSemanticStateSnapshot(runtime, probe),
    normalizedActions: normalizeCommittedActions(context.actions, probe),
    movementRequests: movementRequests.map(request => describeMovementRequest(world, request, probe)),
    initiativeGroups,
  }
}

function capturePrelude(label: string, runtime: PreparedWorld['runtime'], probe: OrderingProbeResult, actions: readonly BattleAction[], actionStart: number, movementRequestCount: number): PreludeBoundary {
  return { label, state: captureSemanticStateSnapshot(runtime, probe), actions: normalizeCommittedActions(actions.slice(actionStart), probe), movementRequestCount }
}

function createActorRecord(
  groupOrdinal: number,
  speed: number,
  processingOrdinal: number,
  world: CombatWorld,
  entityId: EntityId,
  probe: OrderingProbeResult,
  before: ActorStateView,
  beforeSectors: SemanticSector[],
  targeting: { state: ActorStateView; semanticTarget: string | null; sectors: SemanticSector[] } | null,
  attempted: boolean,
  succeeded: boolean | null,
  reservation: { state: ActorStateView; semanticTarget: string | null; slot: number | null; waitingTarget: string | null; sectors: SemanticSector[] } | null,
  melee: { sectors: Map<EntityId, number> },
): ActorTraceRecord {
  const current = reservation?.state ?? targeting?.state ?? before
  return {
    groupOrdinal, speed, processingOrdinal,
    semanticActor: semanticId(world, entityId, probe),
    productionExternalId: world.stores.identity.require(entityId).id,
    before: { ...before, meleeSectors: beforeSectors },
    targeting: {
      ...(targeting?.state ?? before), semanticTarget: targeting?.semanticTarget ?? null,
      meleeSectors: targeting?.sectors ?? captureSectors(world, melee, probe),
    },
    reservation: {
      attempted, succeeded, semanticTarget: reservation?.semanticTarget ?? targeting?.semanticTarget ?? null,
      slot: reservation?.slot ?? getSlot(current), waitingTarget: reservation?.waitingTarget ?? getTarget(current.entityTargets, 'meleeWaitingTarget'),
      meleeSectors: reservation?.sectors ?? captureSectors(world, melee, probe), state: current,
    },
  }
}

function captureActorState(runtime: PreparedWorld['runtime'], probe: OrderingProbeResult, entityId: EntityId): ActorStateView {
  const snapshot = captureSemanticStateSnapshot(runtime, probe)
  const actor = snapshot.entities.find(item => item.internalEntityId === entityId)
  if (!actor) throw new Error(`ACTOR_TRACE_ENTITY_MISSING:${entityId}`)
  return { entityTargets: structuredClone(actor.entityTargets), targeting: structuredClone(actor.targeting) }
}

function captureSectors(world: CombatWorld, melee: { sectors: Map<EntityId, number> }, probe: OrderingProbeResult): SemanticSector[] {
  return [...melee.sectors.entries()]
    .map(([entityId, occupiedMask]) => ({ semanticTarget: semanticId(world, entityId, probe), occupiedMask }))
    .sort((left, right) => compareCodeUnit(left.semanticTarget, right.semanticTarget))
}

function applyOrderOverride(world: CombatWorld, entityIds: readonly EntityId[], semanticOrder: readonly string[] | undefined, probe: OrderingProbeResult): EntityId[] {
  if (!semanticOrder) return [...entityIds]
  const bySemantic = new Map(entityIds.map(entityId => [semanticId(world, entityId, probe), entityId]))
  if (bySemantic.size !== semanticOrder.length || semanticOrder.some(actor => !bySemantic.has(actor))) throw new Error('ACTOR_ORDER_COUNTERFACTUAL_CONTAMINATED')
  return semanticOrder.map(actor => bySemantic.get(actor)!)
}

function compareIntents(world: CombatWorld, left: EcsActionIntent, right: EcsActionIntent): number {
  return compareExternalIdsForMode(world, left.kind, right.kind) ||
    compareExternalIdsForMode(world, left.actorExternalId, right.actorExternalId) ||
    compareExternalIdsForMode(world, left.targetExternalId, right.targetExternalId) ||
    left.sequence - right.sequence
}
