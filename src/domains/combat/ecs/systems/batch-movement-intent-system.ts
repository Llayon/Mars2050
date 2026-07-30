import type { BattleAction } from '../../combat.actions'
import { getFlowVector } from '../../combat.pathfinding'
import type { RuntimeMovementContext } from '../../combat.runtime'
import { FIELD_HEIGHT, FIELD_WIDTH, getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type {
  MovementIntent,
  MovementNeighborGraph,
  MovementRequest,
} from '../movement-batch.types'
import {
  blendMovementVelocity as blendVelocity,
  clampMovementValue as clamp,
  clampMovementVelocity as clampVelocity,
  normalizeMovementAngle as normalizeAngle,
} from '../movement-batch-math'
import { getEcsPositioningDecision } from '../movement-positioning'
import {
  getEcsFormationForce,
  getEcsObstacleCorrection,
  getEcsSteeringContext,
} from '../movement-steering'
import {
  getEcsMovementSpeed,
  getEcsRecoveryForce,
  syncEcsMovementActivity,
  syncEcsMovementIntentModes,
  updateEcsStuckRecovery,
} from '../movement-state'

export function createBatchMovementIntent(
  world: CombatWorld,
  request: MovementRequest,
  graph: MovementNeighborGraph,
  actions: BattleAction[],
  context: RuntimeMovementContext,
): MovementIntent | null {
  const { entityId, targetId } = request
  const vitality = world.stores.vitality.get(entityId)
  const frozen = graph.frame.transforms[entityId]
  const frozenTarget = graph.frame.transforms[targetId]
  if (!vitality || vitality.isDead || !frozen || !frozenTarget) return null

  const identity = world.stores.identity.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const transform = {
    x: frozen.x,
    y: frozen.y,
    velocity: { x: frozen.velocityX, y: frozen.velocityY },
    currentAngle: frozen.currentAngle,
    size: frozen.size,
    isFlying: frozen.isFlying,
  }
  const neighbors = graph.neighbors.get(entityId)
  const distance = getDistance(transform.x, transform.y, frozenTarget.x, frozenTarget.y)
  const targetRadius = getSizeRadius(frozenTarget.size)
  const myRadius = getSizeRadius(transform.size)
  const distEdge = distance - targetRadius - myRadius
  const positioning = getEcsPositioningDecision(
    world, entityId, targetId, distEdge, targetRadius, myRadius,
  )
  syncEcsMovementIntentModes(world, entityId, positioning.shouldMove, actions)
  const effectiveSpeed = getEcsMovementSpeed(world, entityId)
  const steeringInRange = positioning.combatInRange && !positioning.shouldMove
  updateEcsStuckRecovery(world, entityId, targetId, distance, steeringInRange)
  const steering = getEcsSteeringContext(
    world, entityId, neighbors, myRadius, steeringInRange, graph.frame,
  )
  const facingPoint = positioning.shouldMove ? positioning.point : frozenTarget
  let targetAngle = identity.squadId && steering.squadCount > 1 &&
    distance > combat.range * 1.5
    ? Math.atan2(positioning.point.y - steering.squadCy, positioning.point.x - steering.squadCx)
    : Math.atan2(facingPoint.y - transform.y, facingPoint.x - transform.x)
  let navigating = false

  if (!transform.isFlying && positioning.shouldMove &&
      getDistance(transform.x, transform.y, positioning.point.x, positioning.point.y) > 20) {
    const flowAngle = getFlowVector(
      context.flowField,
      transform.x,
      transform.y,
      positioning.point.x,
      positioning.point.y,
    )
    if (flowAngle !== null) {
      const directAngle = Math.atan2(
        positioning.point.y - transform.y,
        positioning.point.x - transform.x,
      )
      const difference = normalizeAngle(flowAngle - directAngle)
      if (movement.isNavigatingObstacle) {
        if (Math.abs(difference) > 0.25) {
          targetAngle = flowAngle
          navigating = true
        } else {
          targetAngle = directAngle
          movement.isNavigatingObstacle = false
        }
      } else if (Math.abs(difference) > 0.55) {
        targetAngle = flowAngle
        navigating = true
        movement.isNavigatingObstacle = true
      } else targetAngle = directAngle
    }
  }

  const angleDifference = normalizeAngle(targetAngle - transform.currentAngle)
  const maxTurn = movement.turnSpeed * context.dt
  transform.currentAngle = normalizeAngle(
    Math.abs(angleDifference) <= maxTurn
      ? targetAngle
      : transform.currentAngle + Math.sign(angleDifference) * maxTurn,
  )

  if (effectiveSpeed <= 0) {
    movement.isMoving = false
    syncEcsMovementActivity(world, entityId, false, actions)
    return createIntent(request, identity.team, frozen.x, frozen.y, transform, angleDifference, false)
  }

  if (steeringInRange) {
    movement.isMoving = false
    syncEcsMovementActivity(world, entityId, false, actions)
    let vx = steering.separationX
    let vy = steering.separationY
    if (!transform.isFlying) {
      const correction = getEcsObstacleCorrection(
        world, entityId, context.obstacles, myRadius, effectiveSpeed, graph.frame,
      )
      vx += correction.x
      vy += correction.y
    }
    const magnitude = Math.hypot(vx, vy)
    if (magnitude <= 0.5) {
      transform.velocity.x = 0
      transform.velocity.y = 0
      return createIntent(request, identity.team, frozen.x, frozen.y, transform, angleDifference, false)
    }
    const maxSpeed = Math.max(effectiveSpeed * 1.2, 12)
    if (magnitude > maxSpeed) {
      vx = (vx / magnitude) * maxSpeed
      vy = (vy / magnitude) * maxSpeed
    }
    blendVelocity(transform.velocity, vx, vy, context.dt, maxSpeed)
    transform.x = clamp(transform.x + transform.velocity.x * context.dt, 0, FIELD_WIDTH)
    transform.y = clamp(transform.y + transform.velocity.y * context.dt, 0, FIELD_HEIGHT)
    return createIntent(request, identity.team, frozen.x, frozen.y, transform, angleDifference, false)
  }

  movement.isMoving = positioning.shouldMove
  syncEcsMovementActivity(world, entityId, positioning.shouldMove, actions)
  let vx = positioning.shouldMove ? Math.cos(transform.currentAngle) * effectiveSpeed : 0
  let vy = positioning.shouldMove ? Math.sin(transform.currentAngle) * effectiveSpeed : 0
  if (!transform.isFlying) {
    const correction = getEcsObstacleCorrection(
      world, entityId, context.obstacles, myRadius, effectiveSpeed, graph.frame,
    )
    vx += correction.x
    vy += correction.y
  }
  const cohesion = getEcsFormationForce(
    world,
    entityId,
    positioning.point,
    steering.squadCx,
    steering.squadCy,
    steering.squadCount,
    distEdge,
    navigating,
    graph.frame,
  )
  vx += cohesion.x + steering.separationX + steering.alignmentX
  vy += cohesion.y + steering.separationY + steering.alignmentY
  const recovery = getEcsRecoveryForce(world, entityId, targetId, context.obstacles)
  vx += recovery.forceX
  vy += recovery.forceY
  if (recovery.isRecovering) movement.isNavigatingObstacle = true
  const maxSpeed = Math.max(effectiveSpeed * 1.6, 18)
  const desiredMagnitude = Math.hypot(vx, vy)
  if (desiredMagnitude < 0.5) {
    vx = 0
    vy = 0
  } else if (desiredMagnitude > maxSpeed) {
    vx = (vx / desiredMagnitude) * maxSpeed
    vy = (vy / desiredMagnitude) * maxSpeed
  }
  if (desiredMagnitude > 0.5) blendVelocity(transform.velocity, vx, vy, context.dt, maxSpeed)
  else {
    transform.velocity.x *= 0.6
    transform.velocity.y *= 0.6
    clampVelocity(transform.velocity, maxSpeed)
  }
  transform.x = clamp(transform.x + transform.velocity.x * context.dt, 0, FIELD_WIDTH)
  transform.y = clamp(transform.y + transform.velocity.y * context.dt, 0, FIELD_HEIGHT)
  return createIntent(
    request, identity.team, frozen.x, frozen.y, transform, angleDifference,
    movement.isMoving ?? false,
  )
}

function createIntent(
  request: MovementRequest,
  team: MovementIntent['team'],
  fromX: number,
  fromY: number,
  transform: {
    x: number
    y: number
    velocity: { x: number; y: number }
    currentAngle: number
  },
  angleDifference: number,
  isWalking: boolean,
): MovementIntent {
  return {
    ...request,
    team,
    fromX,
    fromY,
    toX: transform.x,
    toY: transform.y,
    velocityX: transform.velocity.x,
    velocityY: transform.velocity.y,
    facingAngle: transform.currentAngle,
    angleDifference,
    isWalking,
    motionKind: isWalking ? 'locomotion' : 'steering',
  }
}
