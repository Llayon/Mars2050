import type { BattleAction } from '../../combat.actions.js'
import type { RuntimePhaseContext } from '../../combat.phase.js'
import type { RuntimeMovementContext } from '../../combat.runtime.js'
import { TILE_SIZE } from '../../combat.utils.js'
import { recordEcsChargeMovement } from '../movement-state.js'
import type { CombatWorld } from '../combat-world.js'
import { createMovementFrame } from '../movement-frame.js'
import { buildMovementNeighborGraph } from '../movement-neighbor-graph.js'
import { solveBatchMovementCollisions } from '../movement-collision-solver.js'
import type { MovementIntent } from '../movement-batch.types.js'
import { createBatchMovementIntent } from './batch-movement-intent-system.js'

export function runBatchMovementSystem(
  world: CombatWorld,
  context: RuntimePhaseContext,
): void {
  const requests = world.resources.require('movementRequests')
  const frame = createMovementFrame(world)
  const graph = buildMovementNeighborGraph(world, frame)
  const movementContext: RuntimeMovementContext = {
    dt: world.resources.require('clock').dt,
    rng: context.rng ?? world.resources.require('rng'),
    flowField: world.resources.require('flowField'),
    obstacles: world.resources.require('obstacles'),
  }
  const intents = requests.flatMap(request => {
    const intent = createBatchMovementIntent(
      world, request, graph, context.actions, movementContext,
    )
    return intent ? [intent] : []
  })
  const dirtyEntities = new Set(world.resources.require('dirtySpatialEntities'))
  world.resources.require('dirtySpatialEntities').clear()
  for (const intent of intents) {
    if (Math.hypot(intent.toX - intent.fromX, intent.toY - intent.fromY) > 0.1) {
      dirtyEntities.add(intent.entityId)
    }
  }
  const collisions = solveBatchMovementCollisions(world, frame, intents, dirtyEntities)
  world.resources.require('entitySpatial').recordBatchMovement({
    intents: intents.length,
    neighborCandidates: graph.candidatePairCount,
    neighborEdges: graph.edgeCount,
    collisionCandidates: collisions.candidatePairCount,
    collisionOverlaps: collisions.overlapPairCount,
    dirtyCells: countDirtyCells(graph.frame, dirtyEntities),
  })
  commitIntents(world, frame, intents, collisions, context.actions)
}

function countDirtyCells(
  frame: ReturnType<typeof createMovementFrame>,
  dirtyEntities: ReadonlySet<number>,
): number {
  const keys = new Set<string>()
  for (const entityId of dirtyEntities) {
    const transform = frame.transforms[entityId]
    if (transform) {
      keys.add(
        `${Math.floor(transform.x / TILE_SIZE)}:${Math.floor(transform.y / TILE_SIZE)}`,
      )
    }
  }
  return keys.size
}

function commitIntents(
  world: CombatWorld,
  frame: ReturnType<typeof createMovementFrame>,
  intents: readonly MovementIntent[],
  collisions: ReturnType<typeof solveBatchMovementCollisions>,
  actions: BattleAction[],
): void {
  const intentByEntity = new Map(intents.map(intent => [intent.entityId, intent]))
  const changed = new Set(collisions.corrected)
  const positionChanged = new Set(collisions.corrected)
  for (const intent of intents) {
    changed.add(intent.entityId)
    if (Math.hypot(
      collisions.x[intent.entityId] - intent.fromX,
      collisions.y[intent.entityId] - intent.fromY,
    ) > 0.1) positionChanged.add(intent.entityId)
  }

  for (const entityId of changed) {
    const transform = world.stores.transform.get(entityId)
    if (!transform) continue
    const intent = intentByEntity.get(entityId)
    if (intent) transform.currentAngle = intent.facingAngle
    transform.velocity.x = collisions.velocityX[entityId]
    transform.velocity.y = collisions.velocityY[entityId]
  }
  world.setEntityPositionsBatch(
    [...positionChanged].map(entityId => ({
      entityId,
      x: collisions.x[entityId],
      y: collisions.y[entityId],
    })),
  )

  for (const intent of [...intents].sort((left, right) =>
    left.initiativeIndex - right.initiativeIndex || left.entityId - right.entityId,
  )) {
    emitIntentAction(world, intent, collisions, actions, positionChanged.has(intent.entityId))
  }
  const intentIds = new Set(intents.map(intent => intent.entityId))
  for (const entityId of [...collisions.corrected].sort((left, right) => left - right)) {
    if (intentIds.has(entityId)) continue
    const frozen = frame.transforms[entityId]
    if (frozen) emitCorrectionAction(world, entityId, frozen, actions, positionChanged.has(entityId))
  }
}

function emitIntentAction(
  world: CombatWorld,
  intent: MovementIntent,
  collisions: ReturnType<typeof solveBatchMovementCollisions>,
  actions: BattleAction[],
  positionWritten: boolean,
): void {
  const transform = world.stores.transform.require(intent.entityId)
  const displacement = Math.hypot(transform.x - intent.fromX, transform.y - intent.fromY)
  recordEcsChargeMovement(world, intent.entityId, displacement)
  // Journal completeness: whenever the world position was committed, the move must be
  // published even if the resulting displacement is <= 0.1 (collision corrections can
  // cancel an intent). Turning-only intents that write nothing are still published only
  // when the facing changed, and they must not invent coordinates the world never reached.
  if (!positionWritten && displacement <= 0.1 && Math.abs(intent.angleDifference) <= 0.2) return
  const publishedX = positionWritten ? collisions.x[intent.entityId] : intent.fromX
  const publishedY = positionWritten ? collisions.y[intent.entityId] : intent.fromY
  actions.push({
    unitId: world.stores.identity.require(intent.entityId).id,
    type: 'move',
    ...(intent.targetId !== undefined
      ? { targetId: world.stores.identity.require(intent.targetId).id }
      : {}),
    fromX: round(intent.fromX),
    fromY: round(intent.fromY),
    toX: round(publishedX),
    toY: round(publishedY),
    facingAngle: round(intent.facingAngle),
    isWalking: intent.isWalking,
    motionKind: displacement <= 0.1 ? 'turn' : intent.motionKind,
  })
}

function emitCorrectionAction(
  world: CombatWorld,
  entityId: number,
  from: { x: number; y: number },
  actions: BattleAction[],
  positionWritten: boolean,
): void {
  if (!positionWritten) return
  const transform = world.stores.transform.require(entityId)
  if (Math.hypot(transform.x - from.x, transform.y - from.y) <= 0) return
  actions.push({
    unitId: world.stores.entityMeta.require(entityId).externalId,
    type: 'move',
    fromX: round(from.x),
    fromY: round(from.y),
    toX: round(transform.x),
    toY: round(transform.y),
    facingAngle: round(transform.currentAngle),
    isWalking: false,
    motionKind: 'depenetration',
  })
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
