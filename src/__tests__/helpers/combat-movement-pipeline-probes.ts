import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime, type EcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { createMovementFrame } from '@/domains/combat/ecs/movement-frame'
import { buildMovementNeighborGraph } from '@/domains/combat/ecs/movement-neighbor-graph'
import { solveBatchMovementCollisions } from '@/domains/combat/ecs/movement-collision-solver'
import { createBatchMovementIntent } from '@/domains/combat/ecs/systems/batch-movement-intent-system'
import type { EntityId } from '@/domains/combat/ecs/entity'
import type { MovementIntent, MovementRequest } from '@/domains/combat/ecs/movement-batch.types'
import type { OrderingProbeResult } from './combat-ordering-probes'
import { captureCollisionPairs, captureRecovery, captureSteeringExactPairs } from './combat-movement-pipeline-diagnostics'
import type { MovementCell, MovementRequestRecord, PhysicalMovementIntent, PipelineCellResult, Stage0Checkpoint, Stage0Entity } from './combat-movement-pipeline-types'

interface PreparedWorld {
  runtime: EcsCombatRuntime
  rng: PRNG
  actions: BattleAction[]
}

export function captureMovementPipelineCell(
  scenario: CombatBalanceScenario,
  seed: number,
  cell: MovementCell,
  probe: OrderingProbeResult,
  executionSemanticOrder?: readonly string[],
): PipelineCellResult {
  const diagnostic = prepareWorld(scenario, seed, probe)
  const context = { tick: 0, actions: diagnostic.actions, rng: diagnostic.rng, activeGlobals: [] }
  diagnostic.runtime.runStage('pre_action', context)
  diagnostic.runtime.runStage('action', context)
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
  const collision = solveBatchMovementCollisions(diagnostic.runtime.world, frame, intents, dirty)
  const collisionPairs = captureCollisionPairs(diagnostic.runtime, frame, collision.x, collision.y, dirty, probe)
  const exactCollisionPairs = collisionPairs.filter(pair => pair.distanceSquared === 0)
  const exactSteeringPairs = captureSteeringExactPairs(diagnostic.runtime, frame, graph, probe)
  const recovery = captureRecovery(diagnostic.runtime, probe)
  const committed = captureCommittedStage(scenario, seed, probe, requests)
  return {
    cell, probe, stage0, requests: describeRequests(productionRequests, requests, diagnostic.runtime, probe),
    intents: intents.map(intent => describeIntent(diagnostic.runtime, intent, probe)), collisionPairs,
    exactSteeringPairs, exactCollisionPairs,
    correctedEntities: [...collision.corrected].map(id => semanticId(diagnostic.runtime, id, probe)).sort(compareCodeUnit),
    committedActions: committed.actions, committedTransforms: committed.transforms, recovery,
  }
}

export function compareStage0(left: Stage0Checkpoint, right: Stage0Checkpoint): boolean {
  return JSON.stringify(stripInternalIds(left)) === JSON.stringify(stripInternalIds(right))
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

function prepareWorld(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult): PreparedWorld {
  const runtime = createEcsCombatRuntime({ defenseResolutionMode: 'v9_snapshot' })
  const rng = new PRNG(seed)
  for (const row of probe.attackers) runtime.addSquad(row, 'attacker', rng)
  for (const row of probe.defenders) runtime.addSquad(row, 'defender', rng)
  const actions: BattleAction[] = []
  runtime.world.resources.set('clock', { tick: 0, dt: 0.1, maxTicks: 2000, timeoutPolicy: 'draw' })
  runtime.world.resources.set('rng', rng)
  runtime.world.resources.set('actions', actions)
  runtime.world.resources.set('obstacles', [])
  runtime.world.resources.set('flowField', createPathfindingMap([]))
  runtime.world.resources.set('globals', [])
  runtime.world.resources.set('metrics', undefined)
  runtime.flushStructuralCommands()
  if (scenario.id.length === 0) throw new Error('Movement probe scenario ID is required')
  return { runtime, rng, actions }
}

function captureStage0(runtime: EcsCombatRuntime, probe: OrderingProbeResult): Stage0Checkpoint {
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
  requests: readonly MovementRequest[],
): { actions: BattleAction[]; transforms: PipelineCellResult['committedTransforms'] } {
  const prepared = prepareWorld(scenario, seed, probe)
  const context = { tick: 0, actions: prepared.actions, rng: prepared.rng, activeGlobals: [] }
  prepared.runtime.runStage('pre_action', context)
  prepared.runtime.runStage('action', context)
  prepared.runtime.world.resources.set('movementRequests', requests.map(request => ({ ...request })))
  prepared.runtime.runPhase('batch_movement', context)
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
  return { actions: prepared.actions, transforms }
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
