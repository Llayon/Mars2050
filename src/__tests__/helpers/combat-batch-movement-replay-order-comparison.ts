import { canonicalSerialize } from './combat-semantic-state-diff'
import type { BatchMovementCell, BatchPairComparison } from './combat-batch-movement-replay-order-types'

export function compareBatchCells(left: BatchMovementCell, right: BatchMovementCell): BatchPairComparison {
  const requestOrderEquivalent = canonicalSerialize(left.requests) === canonicalSerialize(right.requests)
  const semanticRequestSequenceEquivalent = canonicalSerialize(semanticRequestSequence(left.requests)) === canonicalSerialize(semanticRequestSequence(right.requests))
  const requestContentEquivalent = canonicalSerialize(sortRequests(left.requests)) === canonicalSerialize(sortRequests(right.requests))
  const initiativeAssignmentEquivalent = canonicalSerialize(assignments(left)) === canonicalSerialize(assignments(right))
  const planningActionMultisetEquivalent = canonicalSerialize(sortRecords(left.planningActions)) === canonicalSerialize(sortRecords(right.planningActions))
  const planningActionSequenceEquivalent = canonicalSerialize(left.planningActions) === canonicalSerialize(right.planningActions)
  const moveActionMultisetEquivalent = canonicalSerialize(sortRecords(left.committedMoveActions)) === canonicalSerialize(sortRecords(right.committedMoveActions))
  const moveActionSequenceEquivalent = canonicalSerialize(left.committedMoveActions) === canonicalSerialize(right.committedMoveActions)
  const stateEquivalent = canonicalSerialize(left.endpoint) === canonicalSerialize(right.endpoint)
  const transformsEquivalent = canonicalSerialize(left.transforms) === canonicalSerialize(right.transforms)
  const collisionEquivalent = canonicalSerialize(left.collisionProfile) === canonicalSerialize(right.collisionProfile)
  const dirtyEntitiesEquivalent = canonicalSerialize(left.dirtyEntities) === canonicalSerialize(right.dirtyEntities)
  const orderEffect = !stateEquivalent || !transformsEquivalent || !collisionEquivalent
    ? 'MOVEMENT_STATE'
    : !planningActionSequenceEquivalent || !moveActionSequenceEquivalent
      ? 'PLANNING_ACTION_ORDER'
      : 'NONE'
  const movementStateEquivalent = stateEquivalent && transformsEquivalent && collisionEquivalent && dirtyEntitiesEquivalent
  const replayOnly = movementStateEquivalent && planningActionMultisetEquivalent && planningActionSequenceEquivalent &&
    moveActionMultisetEquivalent && !moveActionSequenceEquivalent
  const initiativeEffect = !movementStateEquivalent
    ? 'STATE_EFFECT'
    : replayOnly
      ? 'MOVE_REPLAY_ORDER_ONLY'
      : !planningActionSequenceEquivalent || !moveActionSequenceEquivalent
        ? 'UNRESOLVED'
        : 'NONE'
  return {
    requestOrderEquivalent, semanticRequestSequenceEquivalent, requestContentEquivalent, initiativeAssignmentEquivalent,
    planningActionMultisetEquivalent, planningActionSequenceEquivalent,
    moveActionMultisetEquivalent, moveActionSequenceEquivalent, stateEquivalent,
    transformsEquivalent, collisionEquivalent, dirtyEntitiesEquivalent,
    requestOrderEffect: orderEffect, initiativeAssignmentEffect: initiativeEffect,
  }
}

export function sortRequests(requests: readonly BatchMovementCell['requests'][number][]): unknown[] {
  return semanticRequestSequence(requests)
    .sort((left, right) => canonicalSerialize(left).localeCompare(canonicalSerialize(right)))
}

export function semanticRequestSequence(requests: readonly BatchMovementCell['requests'][number][]): unknown[] {
  return requests.map(request => ({
    kind: request.kind,
    semanticActor: request.semanticActor,
    semanticTarget: request.semanticTarget,
    targetX: request.targetX,
    targetY: request.targetY,
  }))
}

function assignments(cell: BatchMovementCell): unknown[] {
  return cell.requests.map(request => ({
    kind: request.kind, semanticActor: request.semanticActor, semanticTarget: request.semanticTarget,
    targetX: request.targetX, targetY: request.targetY, initiativeIndex: request.initiativeIndex,
  })).sort((left, right) => canonicalSerialize(left).localeCompare(canonicalSerialize(right)))
}

function sortRecords(records: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return [...records].sort((left, right) => canonicalSerialize(left).localeCompare(canonicalSerialize(right)))
}
