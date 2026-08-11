import type { CollisionPairRecord, PipelineCellResult, PhysicalMovementIntent, Stage0Checkpoint } from './combat-movement-pipeline-types'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { buildMovementCollisionPairs } from '@/domains/combat/ecs/movement-collision-pairs'
import type { EcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import type { EntityId } from '@/domains/combat/ecs/entity'
import type { MovementFrame, MovementNeighborGraph } from '@/domains/combat/ecs/movement-batch.types'
import type { OrderingProbeResult } from './combat-ordering-probes'
export type MovementMechanism =
  | 'NO_DIVERGENCE' | 'REQUEST_ITERATION_ORDER_SUPPORTED' | 'ID_DERIVED_INTENT_SUPPORTED'
  | 'STEERING_EXACT_OVERLAP_SUPPORTED' | 'ID_DERIVED_RECOVERY_SUPPORTED' | 'STUCK_RECOVERY_DOWNSTREAM'
  | 'COLLISION_EXACT_OVERLAP_SUPPORTED' | 'COLLISION_OTHER_UNRESOLVED' | 'COMMIT_LAYER_UNRESOLVED'
  | 'ENTITY_ID_MAPPING_CONTAMINATED' | 'MIXED' | 'UNRESOLVED'
export interface StageComparison {
  stage0Equivalent: boolean
  requestPayloadEquivalent: boolean
  requestOrderChanged: boolean
  intentEquivalent: boolean
  collisionEquivalent: boolean
  collisionPairSetEquivalent: boolean
  collisionPairOrderEquivalent: boolean
  committedEquivalent: boolean
  firstIntentDivergence: { actor: string; field: string } | null
  firstCommitDivergence: { actor: string; field: string } | null
}

export interface MovementPipelineAssessment {
  stageComparison: StageComparison
  earliestCausalLayer: 'none' | 'stage1' | 'stage2' | 'stage3' | 'stage4'
  stageSpecificEffect: 'none' | 'REQUEST_ITERATION_INTENT_EFFECT' | 'ID_CONTENT_INTENT_EFFECT' | 'REQUEST_ITERATION_COLLISION_EFFECT' | 'ID_CONTENT_COLLISION_EFFECT' | 'COMMIT_LAYER_EFFECT'
  mechanism: MovementMechanism
  mappingStatus: 'equivalent' | 'ENTITY_ID_MAPPING_CONTAMINATED'
  exactSteeringPairs: number
  exactCollisionPairs: number
  recoveryActivated: boolean
}

export function assertSemanticIdentityMapping(left: PipelineCellResult, right: PipelineCellResult): void {
  const leftMap = new Map(left.stage0.entities.map(entity => [entity.semanticActor, entity.internalEntityId]))
  const rightMap = new Map(right.stage0.entities.map(entity => [entity.semanticActor, entity.internalEntityId]))
  if (JSON.stringify([...leftMap].sort(comparePair)) !== JSON.stringify([...rightMap].sort(comparePair))) {
    throw new Error('ENTITY_ID_MAPPING_CONTAMINATED')
  }
}

export function comparePipelineCells(left: PipelineCellResult, right: PipelineCellResult): MovementPipelineAssessment {
  let mappingStatus: MovementPipelineAssessment['mappingStatus'] = 'equivalent'
  try { assertSemanticIdentityMapping(left, right) } catch { mappingStatus = 'ENTITY_ID_MAPPING_CONTAMINATED' }
  const stage0Equivalent = compareStage0(left.stage0, right.stage0)
  const requestPayloadEquivalent = compareRequestPayload(left, right)
  const requestOrderChanged = JSON.stringify(left.requests.map(request => request.semanticActor)) !== JSON.stringify(right.requests.map(request => request.semanticActor))
  const intentDivergence = firstIntentDivergence(left.intents, right.intents)
  const intentEquivalent = intentDivergence === null
  const collisionEquivalent = JSON.stringify(normalizeCollisionResults(left)) === JSON.stringify(normalizeCollisionResults(right))
  const collisionPairSetEquivalent = JSON.stringify(normalizeCollisionPairSet(left)) === JSON.stringify(normalizeCollisionPairSet(right))
  const collisionPairOrderEquivalent = JSON.stringify(normalizeCollisionPairOrder(left)) === JSON.stringify(normalizeCollisionPairOrder(right))
  const commitDivergence = firstCommitDivergence(left, right)
  const committedEquivalent = commitDivergence === null
  const stageComparison = { stage0Equivalent, requestPayloadEquivalent, requestOrderChanged, intentEquivalent, collisionEquivalent, collisionPairSetEquivalent, collisionPairOrderEquivalent, committedEquivalent, firstIntentDivergence: intentDivergence, firstCommitDivergence: commitDivergence }
  const earliestCausalLayer = !stage0Equivalent ? 'stage1' : !requestPayloadEquivalent || (requestOrderChanged && !intentEquivalent) ? 'stage2' : !collisionEquivalent ? 'stage3' : !committedEquivalent ? 'stage4' : 'none'
  const stageSpecificEffect = classifyStageEffect(left, right, stageComparison)
  return {
    stageComparison, earliestCausalLayer, stageSpecificEffect,
    mechanism: classifyMechanism(left, right, stageComparison, mappingStatus, stageSpecificEffect),
    mappingStatus,
    exactSteeringPairs: left.exactSteeringPairs.length + right.exactSteeringPairs.length,
    exactCollisionPairs: left.preSolverExactCollisionPairs.length + right.preSolverExactCollisionPairs.length,
    recoveryActivated: Object.values(left.recovery).some(isRecovery) || Object.values(right.recovery).some(isRecovery),
  }
}

export function compareStage0(left: Stage0Checkpoint, right: Stage0Checkpoint): boolean {
  const normalize = (checkpoint: Stage0Checkpoint) => checkpoint.entities.map(entity => {
    return Object.fromEntries(Object.entries(entity).filter(([key]) => key !== 'internalEntityId'))
  })
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right)) && left.clock.dt === right.clock.dt && JSON.stringify(left.obstacles) === JSON.stringify(right.obstacles) && JSON.stringify(left.dirtyEntities) === JSON.stringify(right.dirtyEntities)
}

function compareRequestPayload(left: PipelineCellResult, right: PipelineCellResult): boolean {
  const normalize = (cell: PipelineCellResult) => cell.requests.map(request => ({
    actor: request.semanticActor, kind: request.kind, target: request.semanticTarget,
    payload: request.payload, initiativeIndex: request.initiativeIndex,
  })).sort((a, b) => compareString(JSON.stringify(a), JSON.stringify(b)))
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

function normalizeCollisionPairSet(cell: PipelineCellResult): string[] {
  return cell.preSolverCollisionPairs.map(pair => pair.semanticPair.join('|')).sort(compareString)
}

function normalizeCollisionPairOrder(cell: PipelineCellResult): string[] {
  return cell.preSolverCollisionPairs.map(pair => `${pair.semanticPair.join('|')}:${pair.pairOrder}`)
}

function normalizeCollisionResults(cell: PipelineCellResult): unknown[] {
  return Object.entries(cell.collisionResultBySemanticActor).sort(([left], [right]) => compareString(left, right)).map(([semanticActor, result]) => ({ semanticActor, ...result }))
}

function firstIntentDivergence(left: readonly PhysicalMovementIntent[], right: readonly PhysicalMovementIntent[]): StageComparison['firstIntentDivergence'] {
  const rightByActor = new Map(right.map(intent => [intent.semanticActor, intent]))
  const fields: (keyof PhysicalMovementIntent)[] = ['semanticTarget', 'requestKind', 'fromX', 'fromY', 'toX', 'toY', 'velocityX', 'velocityY', 'facingAngle', 'angleDifference', 'isWalking', 'motionKind']
  for (const candidate of left) {
    const other = rightByActor.get(candidate.semanticActor)
    if (!other) return { actor: candidate.semanticActor, field: 'missing' }
    for (const field of fields) if (candidate[field] !== other[field]) return { actor: candidate.semanticActor, field }
  }
  return left.length === right.length ? null : { actor: 'unknown', field: 'count' }
}

function firstCommitDivergence(left: PipelineCellResult, right: PipelineCellResult): StageComparison['firstCommitDivergence'] {
  const actors = [...new Set([...Object.keys(left.committedTransforms), ...Object.keys(right.committedTransforms)])].sort(compareString)
  for (const actor of actors) {
    const a = left.committedTransforms[actor], b = right.committedTransforms[actor]
    if (!a || !b) return { actor, field: 'missing' }
    for (const field of ['x', 'y', 'velocityX', 'velocityY', 'angle'] as const) if (a[field] !== b[field]) return { actor, field }
  }
  return JSON.stringify(normalizeCommittedActionSet(left)) === JSON.stringify(normalizeCommittedActionSet(right)) ? null : { actor: 'actions', field: 'semanticSet' }
}

function normalizeCommittedActionSet(cell: PipelineCellResult): string[] {
  return cell.committedActions.map(action => JSON.stringify(action)).sort(compareString)
}

function classifyStageEffect(left: PipelineCellResult, right: PipelineCellResult, comparison: StageComparison): MovementPipelineAssessment['stageSpecificEffect'] {
  if (!comparison.stage0Equivalent) return 'ID_CONTENT_INTENT_EFFECT'
  if (!comparison.intentEquivalent && comparison.requestOrderChanged) return left.cell[0] === right.cell[0] ? 'REQUEST_ITERATION_INTENT_EFFECT' : 'ID_CONTENT_INTENT_EFFECT'
  if (!comparison.collisionEquivalent && comparison.intentEquivalent) return comparison.requestOrderChanged ? 'REQUEST_ITERATION_COLLISION_EFFECT' : 'ID_CONTENT_COLLISION_EFFECT'
  if (!comparison.committedEquivalent && comparison.collisionEquivalent) return 'COMMIT_LAYER_EFFECT'
  return 'none'
}

function classifyMechanism(
  left: PipelineCellResult,
  right: PipelineCellResult,
  comparison: StageComparison,
  mappingStatus: MovementPipelineAssessment['mappingStatus'],
  effect: MovementPipelineAssessment['stageSpecificEffect'],
): MovementMechanism {
  if (mappingStatus !== 'equivalent') return 'ENTITY_ID_MAPPING_CONTAMINATED'
  if (effect === 'none') return 'NO_DIVERGENCE'
  if (effect === 'REQUEST_ITERATION_INTENT_EFFECT') return 'REQUEST_ITERATION_ORDER_SUPPORTED'
  if (effect === 'ID_CONTENT_INTENT_EFFECT') {
    if (left.exactSteeringPairs.length + right.exactSteeringPairs.length > 0) return 'STEERING_EXACT_OVERLAP_SUPPORTED'
    if (Object.values(left.recovery).some(isRecovery) || Object.values(right.recovery).some(isRecovery)) return 'ID_DERIVED_RECOVERY_SUPPORTED'
    return 'ID_DERIVED_INTENT_SUPPORTED'
  }
  if (effect === 'REQUEST_ITERATION_COLLISION_EFFECT') return 'REQUEST_ITERATION_ORDER_SUPPORTED'
  if (effect === 'ID_CONTENT_COLLISION_EFFECT') {
    const exactOverlap = left.preSolverExactCollisionPairs.length + right.preSolverExactCollisionPairs.length > 0
    return exactOverlap && comparison.collisionPairSetEquivalent && comparison.intentEquivalent
      ? 'COLLISION_EXACT_OVERLAP_SUPPORTED' : 'COLLISION_OTHER_UNRESOLVED'
  }
  if (effect === 'COMMIT_LAYER_EFFECT') return comparison.committedEquivalent ? 'UNRESOLVED' : 'COMMIT_LAYER_UNRESOLVED'
  return 'UNRESOLVED'
}

function isRecovery(value: Record<string, unknown>): boolean { return value.recoveryEligible === true }
function comparePair(left: readonly [string, number], right: readonly [string, number]): number { return compareString(left[0], right[0]) }
function compareString(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0 }

export function captureCollisionPairs(runtime: EcsCombatRuntime, frame: MovementFrame, x: readonly number[], y: readonly number[], dirty: ReadonlySet<EntityId>, probe: OrderingProbeResult): CollisionPairRecord[] {
  const pairs = buildMovementCollisionPairs(frame.entityIds, x, y, dirty, 201.6)
  return pairs.map(([firstId, secondId], pairOrder) => {
    const first = runtime.world.stores.entityMeta.require(firstId).externalId
    const second = runtime.world.stores.entityMeta.require(secondId).externalId
    const dx = x[secondId] - x[firstId], dy = y[secondId] - y[firstId]
    return {
      semanticPair: [semanticId(runtime, firstId, probe), semanticId(runtime, secondId, probe)].sort(compareString) as [string, string],
      externalIdPair: [first, second].sort(compareString) as [string, string],
      internalEntityIdPair: [firstId, secondId], x1: x[firstId], y1: y[firstId], x2: x[secondId], y2: y[secondId],
      distanceSquared: dx * dx + dy * dy, pairOrder, fallbackReachable: dx === 0 && dy === 0,
    }
  })
}

export function normalizeCommittedActions(actions: readonly BattleAction[], probe: OrderingProbeResult): Record<string, unknown>[] {
  return actions.map(action => {
    const normalized = cloneAction(action), { unitId, targetId, sourceUnitId } = action
    delete normalized.unitId; delete normalized.targetId; delete normalized.sourceUnitId
    return {
      semanticActor: semanticExternalId(unitId, probe),
      semanticTarget: targetId === undefined ? null : semanticExternalId(targetId, probe),
      semanticSource: sourceUnitId === undefined ? null : semanticExternalId(sourceUnitId, probe),
      ...normalized,
    }
  })
}

export function captureCollisionResult(runtime: EcsCombatRuntime, collision: { x: readonly number[]; y: readonly number[]; velocityX: readonly number[]; velocityY: readonly number[]; corrected: ReadonlySet<EntityId> }, frame: MovementFrame, probe: OrderingProbeResult): PipelineCellResult['collisionResultBySemanticActor'] {
  const result: PipelineCellResult['collisionResultBySemanticActor'] = {}
  for (const entityId of frame.entityIds) {
    result[semanticId(runtime, entityId, probe)] = {
      x: collision.x[entityId]!, y: collision.y[entityId]!,
      velocityX: collision.velocityX[entityId]!, velocityY: collision.velocityY[entityId]!,
      corrected: collision.corrected.has(entityId),
    }
  }
  return result
}

export function captureSteeringExactPairs(runtime: EcsCombatRuntime, frame: MovementFrame, graph: MovementNeighborGraph, probe: OrderingProbeResult): PipelineCellResult['exactSteeringPairs'] {
  const pairs: PipelineCellResult['exactSteeringPairs'] = []
  for (const firstId of frame.entityIds) for (const secondId of graph.neighbors.get(firstId)) {
    if (firstId >= secondId) continue
    const first = frame.transforms[firstId]!, second = frame.transforms[secondId]!
    if (!first.isFlying && !second.isFlying && first.x === second.x && first.y === second.y) {
      pairs.push(capturePair(runtime, firstId, secondId, first.x, first.y, second.x, second.y, pairs.length, probe))
    }
  }
  return pairs
}

export function captureRecovery(runtime: EcsCombatRuntime, probe: OrderingProbeResult): PipelineCellResult['recovery'] {
  const result: PipelineCellResult['recovery'] = {}
  for (const entityId of runtime.world.query(['identity', 'movement'])) {
    const movement = runtime.world.stores.movement.require(entityId)
    const transform = runtime.world.stores.transform.require(entityId)
    const stuckObserved = (movement.stuckTicks ?? 0) > 0
    const avoidanceActive = (movement.avoidanceTicks ?? 0) > 0
    result[semanticId(runtime, entityId, probe)] = {
      stuckTicks: movement.stuckTicks ?? 0, avoidanceTicks: movement.avoidanceTicks ?? 0, avoidanceSide: movement.avoidanceSide ?? null,
      progressTarget: typeof runtime.world.stores.entityTargets.require(entityId).progressTarget === 'number'
        ? semanticId(runtime, runtime.world.stores.entityTargets.require(entityId).progressTarget!, probe) : null,
      lastTargetDistance: movement.lastTargetDistance ?? null, lastProgressX: movement.lastProgressX ?? null,
      lastProgressY: movement.lastProgressY ?? null, stuckObserved, avoidanceActive,
      recoveryEligible: avoidanceActive && !transform.isFlying,
    }
  }
  return result
}

function capturePair(runtime: EcsCombatRuntime, firstId: EntityId, secondId: EntityId, x1: number, y1: number, x2: number, y2: number, pairOrder: number, probe: OrderingProbeResult): CollisionPairRecord {
  const first = runtime.world.stores.entityMeta.require(firstId).externalId, second = runtime.world.stores.entityMeta.require(secondId).externalId
  return { semanticPair: [semanticId(runtime, firstId, probe), semanticId(runtime, secondId, probe)].sort(compareString) as [string, string], externalIdPair: [first, second].sort(compareString) as [string, string], internalEntityIdPair: [firstId, secondId], x1, y1, x2, y2, distanceSquared: (x2 - x1) ** 2 + (y2 - y1) ** 2, pairOrder, fallbackReachable: x1 === x2 && y1 === y2 }
}

function semanticId(runtime: EcsCombatRuntime, entityId: EntityId, probe: OrderingProbeResult): string {
  const externalId = runtime.world.stores.identity.require(entityId).id
  const identity = probe.semanticByExternalId.get(externalId)
  return identity ? `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}` : externalId
}

function semanticExternalId(externalId: string, probe: OrderingProbeResult): string {
  const identity = probe.semanticByExternalId.get(externalId)
  return identity ? `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}` : externalId
}

function cloneAction(action: BattleAction): Record<string, unknown> {
  return JSON.parse(JSON.stringify(action)) as Record<string, unknown>
}
