import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { EcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { createMovementFrame } from '@/domains/combat/ecs/movement-frame'
import { buildMovementNeighborGraph } from '@/domains/combat/ecs/movement-neighbor-graph'
import { solveBatchMovementCollisions } from '@/domains/combat/ecs/movement-collision-solver'
import { createBatchMovementIntent } from '@/domains/combat/ecs/systems/batch-movement-intent-system'
import type { EntityId } from '@/domains/combat/ecs/entity'
import type { MovementIntent, MovementRequest } from '@/domains/combat/ecs/movement-batch.types'
import type { OrderingProbeResult } from './combat-ordering-probes'
import { captureCollisionResult, captureRecovery, captureSteeringExactPairs, normalizeCommittedActions } from './combat-movement-pipeline-diagnostics'
import { captureCollisionPairs } from './combat-movement-pipeline-collision'
import { advanceToPreBatchCheckpoint } from './combat-movement-pipeline-advancement'
import type { MovementCell, MovementRequestRecord, PhysicalMovementIntent, PipelineCellResult, Stage0Checkpoint, Stage0Entity } from './combat-movement-pipeline-types'

export function captureMovementPipelineCell(
  scenario: CombatBalanceScenario,
  seed: number,
  cell: MovementCell,
  probe: OrderingProbeResult,
  targetTick: number,
  executionSemanticOrder?: readonly string[],
): PipelineCellResult {
  const diagnostic = advanceToPreBatchCheckpoint(scenario, seed, probe, targetTick)
  const stage0 = captureStage0(diagnostic.runtime, probe)
  const productionRequests = diagnostic.runtime.world.resources.require('movementRequests').map(request => ({ ...request }))
  const requests = reorderRequests(productionRequests, diagnostic.runtime, probe, executionSemanticOrder)
  diagnostic.runtime.world.resources.set('movementRequests', requests)
  const frame = createMovementFrame(diagnostic.runtime.world)
  const graph = buildMovementNeighborGraph(diagnostic.runtime.world, frame)
  const intents = requests.flatMap(request => {
    const intent = createBatchMovementIntent(diagnostic.runtime.world, request, graph, diagnostic.actions, {
      dt: diagnostic.runtime.world.resources.require('clock').dt,
      rng: diagnostic.rng,
      flowField: diagnostic.runtime.world.resources.require('flowField'),
      obstacles: diagnostic.runtime.world.resources.require('obstacles'),
    })
    return intent ? [intent] : []
  })
  const dirty = new Set(diagnostic.runtime.world.resources.require('dirtySpatialEntities'))
  const preSolverX: number[] = []
  const preSolverY: number[] = []
  for (const entityId of frame.entityIds) {
    preSolverX[entityId] = frame.transforms[entityId]!.x
    preSolverY[entityId] = frame.transforms[entityId]!.y
  }
  for (const intent of intents) {
    preSolverX[intent.entityId] = intent.toX
    preSolverY[intent.entityId] = intent.toY
  }
  const preSolverCollisionPairs = captureCollisionPairs(diagnostic.runtime, frame, preSolverX, preSolverY, dirty, probe)
  const collision = solveBatchMovementCollisions(diagnostic.runtime.world, frame, intents, dirty)
  const preSolverExactCollisionPairs = preSolverCollisionPairs.filter(pair => pair.distanceSquared === 0)
  const exactSteeringPairs = captureSteeringExactPairs(diagnostic.runtime, frame, graph, probe)
  const collisionResultBySemanticActor = captureCollisionResult(diagnostic.runtime, collision, frame, probe)
  const recovery = captureRecovery(diagnostic.runtime, probe)
  const committed = captureCommittedStage(scenario, seed, probe, targetTick, requests, diagnostic.runtime, stage0)
  return {
    cell, targetTick, probe, stage0, requests: describeRequests(productionRequests, requests, diagnostic.runtime, probe),
    intents: intents.map(intent => describeIntent(diagnostic.runtime, intent, probe)), preSolverCollisionPairs,
    preSolverExactCollisionPairs, exactSteeringPairs, collisionResultBySemanticActor,
    correctedEntities: [...collision.corrected].map(id => semanticId(diagnostic.runtime, id, probe)).sort(compareCodeUnit),
    committedActions: committed.actions, committedTransforms: committed.transforms, recovery,
  }
}

export function compareStage0(left: Stage0Checkpoint, right: Stage0Checkpoint): boolean {
  return JSON.stringify(stripInternalIds(left)) === JSON.stringify(stripInternalIds(right)) && left.clock.tick === right.clock.tick
}

export function reorderRequests(
  requests: readonly MovementRequest[],
  runtime: EcsCombatRuntime,
  probe: OrderingProbeResult,
  executionSemanticOrder?: readonly string[],
): MovementRequest[] {
  if (!executionSemanticOrder) return requests.map(request => ({ ...request }))
  const rank = new Map(executionSemanticOrder.map((key, index) => [key, index]))
  return requests.map(request => ({ ...request })).sort((left, right) =>
    (rank.get(semanticRequestActor(left, runtime, probe)) ?? Number.MAX_SAFE_INTEGER) -
    (rank.get(semanticRequestActor(right, runtime, probe)) ?? Number.MAX_SAFE_INTEGER),
  )
}

export function captureStage0(runtime: EcsCombatRuntime, probe: OrderingProbeResult): Stage0Checkpoint {
  const entities = runtime.world.query(['identity', 'transform', 'vitality', 'combat', 'movement'])
    .map(entityId => ({ entityId, key: semanticId(runtime, entityId, probe) }))
    .sort((left, right) => compareCodeUnit(left.key, right.key))
    .map(({ entityId, key }) => ({
      semanticActor: key, internalEntityId: entityId,
      transform: cloneRecord(runtime.world.stores.transform.require(entityId)),
      vitality: cloneRecord(runtime.world.stores.vitality.require(entityId)),
      combat: cloneRecord(runtime.world.stores.combat.require(entityId)),
      movement: cloneRecord(runtime.world.stores.movement.require(entityId)),
      targeting: cloneRecord(runtime.world.stores.targeting.require(entityId)),
      entityTargets: captureEntityTargets(runtime, entityId, probe),
      statusControl: cloneRecord(runtime.world.stores.statusControl.require(entityId)),
      weapon: cloneRecord(runtime.world.stores.weapon.require(entityId)),
      runtimeRules: cloneRecord(runtime.world.stores.runtimeRules.require(entityId)),
    }))
  return {
    entities,
    clock: { dt: runtime.world.resources.require('clock').dt, tick: runtime.world.resources.require('clock').tick },
    obstacles: runtime.world.resources.require('obstacles'),
    dirtyEntities: [...runtime.world.resources.require('dirtySpatialEntities')]
      .map(entityId => semanticId(runtime, entityId, probe)).sort(compareCodeUnit),
  }
}

function captureCommittedStage(
  scenario: CombatBalanceScenario,
  seed: number,
  probe: OrderingProbeResult,
  targetTick: number,
  requests: readonly MovementRequest[],
  sourceRuntime: EcsCombatRuntime,
  sourceStage0: Stage0Checkpoint,
): { actions: Record<string, unknown>[]; transforms: PipelineCellResult['committedTransforms'] } {
  const prepared = advanceToPreBatchCheckpoint(scenario, seed, probe, targetTick)
  const freshStage0 = captureStage0(prepared.runtime, probe)
  if (!compareStage0(sourceStage0, freshStage0)) throw new Error('FRESH_PRE_BATCH_CHECKPOINT_DIVERGENCE')
  assertFreshSemanticMapping(sourceRuntime, prepared.runtime, probe)
  prepared.runtime.world.resources.set('movementRequests', requests.map(request => remapRequest(request, sourceRuntime, prepared.runtime, probe)))
  const committedActionStart = prepared.actions.length
  prepared.runtime.runPhase('batch_movement', prepared.context)
  const transforms: PipelineCellResult['committedTransforms'] = {}
  for (const entityId of prepared.runtime.world.query(['identity', 'transform'])) {
    transforms[semanticId(prepared.runtime, entityId, probe)] = {
      x: prepared.runtime.world.stores.transform.require(entityId).x,
      y: prepared.runtime.world.stores.transform.require(entityId).y,
      velocityX: prepared.runtime.world.stores.transform.require(entityId).velocity.x,
      velocityY: prepared.runtime.world.stores.transform.require(entityId).velocity.y,
      angle: prepared.runtime.world.stores.transform.require(entityId).currentAngle,
    }
  }
  return { actions: normalizeCommittedActions(prepared.actions.slice(committedActionStart), probe), transforms }
}

function remapRequest(request: MovementRequest, sourceRuntime: EcsCombatRuntime, targetRuntime: EcsCombatRuntime, probe: OrderingProbeResult): MovementRequest {
  const entityId = findEntityBySemantic(sourceRuntime, request.entityId, targetRuntime, probe)
  if (request.kind === 'turn') return { ...request, entityId }
  return { ...request, entityId, targetId: findEntityBySemantic(sourceRuntime, request.targetId, targetRuntime, probe) }
}

function findEntityBySemantic(sourceRuntime: EcsCombatRuntime, sourceEntityId: EntityId, targetRuntime: EcsCombatRuntime, probe: OrderingProbeResult): EntityId {
  const key = semanticId(sourceRuntime, sourceEntityId, probe)
  const target = targetRuntime.world.query(['identity']).find(entityId => semanticId(targetRuntime, entityId, probe) === key)
  if (target === undefined) throw new Error(`ENTITY_ID_MAPPING_CONTAMINATED:${key}`)
  return target
}

function assertFreshSemanticMapping(sourceRuntime: EcsCombatRuntime, targetRuntime: EcsCombatRuntime, probe: OrderingProbeResult): void {
  const source = new Map(sourceRuntime.world.query(['identity']).map(entityId => [semanticId(sourceRuntime, entityId, probe), entityId]))
  const target = new Map(targetRuntime.world.query(['identity']).map(entityId => [semanticId(targetRuntime, entityId, probe), entityId]))
  if (JSON.stringify([...source.keys()].sort(compareCodeUnit)) !== JSON.stringify([...target.keys()].sort(compareCodeUnit))) {
    throw new Error('ENTITY_ID_MAPPING_CONTAMINATED')
  }
}

function describeRequests(production: readonly MovementRequest[], execution: readonly MovementRequest[], runtime: EcsCombatRuntime, probe: OrderingProbeResult): MovementRequestRecord[] {
  const productionOrdinals = new Map(production.map((request, index) => [requestSignature(request), index]))
  return execution.map((request, executionArrayOrdinal) => ({
    productionArrayOrdinal: productionOrdinals.get(requestSignature(request)) ?? executionArrayOrdinal, executionArrayOrdinal,
    semanticActor: semanticRequestActor(request, runtime, probe), kind: request.kind,
    semanticTarget: request.kind === 'move' ? semanticId(runtime, request.targetId, probe) : null,
    payload: cloneRecord(request), initiativeIndex: request.initiativeIndex,
  }))
}

function describeIntent(runtime: EcsCombatRuntime, intent: MovementIntent, probe: OrderingProbeResult): PhysicalMovementIntent {
  return {
    semanticActor: semanticId(runtime, intent.entityId, probe),
    semanticTarget: intent.targetId === undefined ? null : semanticId(runtime, intent.targetId, probe),
    requestKind: intent.requestKind, fromX: intent.fromX, fromY: intent.fromY, toX: intent.toX, toY: intent.toY,
    velocityX: intent.velocityX, velocityY: intent.velocityY, facingAngle: intent.facingAngle,
    angleDifference: intent.angleDifference, isWalking: intent.isWalking, motionKind: intent.motionKind,
  }
}

function captureEntityTargets(runtime: EcsCombatRuntime, entityId: EntityId, probe: OrderingProbeResult): Record<string, unknown> {
  const refs = runtime.world.stores.entityTargets.require(entityId)
  return Object.fromEntries(['attackTarget', 'rampTarget', 'meleeTarget', 'meleeWaitingTarget', 'progressTarget'].map(key => {
    const targetId = refs[key as keyof typeof refs]
    return [key, typeof targetId === 'number' ? semanticId(runtime, targetId, probe) : null]
  }))
}

function semanticRequestActor(request: MovementRequest, runtime: EcsCombatRuntime, probe: OrderingProbeResult): string {
  return semanticId(runtime, request.entityId, probe)
}

function semanticId(runtime: EcsCombatRuntime, entityId: EntityId, probe: OrderingProbeResult): string {
  const key = runtime.world.stores.identity.require(entityId).id
  const identity = probe.semanticByExternalId.get(key)
  return identity ? `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}` : key
}

function requestSignature(request: MovementRequest): string {
  return request.kind === 'move'
    ? `move:${request.entityId}:${request.targetId}:${request.initiativeIndex}`
    : `turn:${request.entityId}:${request.targetX}:${request.targetY}:${request.initiativeIndex}`
}

function cloneRecord(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function stripInternalIds(value: Stage0Checkpoint): Omit<Stage0Checkpoint, 'entities'> & { entities: Omit<Stage0Entity, 'internalEntityId'>[] } {
  return { ...value, entities: value.entities.map(entity => {
    return Object.fromEntries(Object.entries(entity).filter(([key]) => key !== 'internalEntityId')) as Omit<Stage0Entity, 'internalEntityId'>
  }) }
}

function compareCodeUnit(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0 }
