import type { BattleAction } from '../../combat.actions'
import { getFlowVector } from '../../combat.pathfinding'
import type { RuntimeMovementContext } from '../../combat.runtime'
import { FIELD_HEIGHT, FIELD_WIDTH, getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsPositioningDecision } from '../movement-positioning'
import { getEcsFormationForce, getEcsObstacleCorrection, getEcsSteeringContext, ECS_MOVEMENT_NEIGHBOR_RADIUS } from '../movement-steering'
import { getEcsMovementSpeed, getEcsRecoveryForce, recordEcsChargeMovement, syncEcsMovementActivity, syncEcsMovementIntentModes, updateEcsStuckRecovery } from '../movement-state'

/**
 * Runs deterministic movement directly against ECS component stores.
 * @param world Combat ECS world
 * @param entityId Moving entity
 * @param targetId Current target entity
 * @param actions Replay action sink
 * @param context Deterministic movement resources
 */
export function runMovementSystem(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  context: RuntimeMovementContext,
): void {
  runMovementMath(world, entityId, targetId, actions, context)
  world.resources.require('entitySpatial').update(world, entityId)
}

function runMovementMath(world: CombatWorld, entityId: EntityId, targetId: EntityId, actions: BattleAction[], context: RuntimeMovementContext): void {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const targetIdentity = world.stores.identity.require(targetId)
  const target = world.stores.transform.require(targetId)
  const neighbors = world.resources.require('entitySpatial').query(world, transform.x, transform.y, ECS_MOVEMENT_NEIGHBOR_RADIUS)
  const distance = getDistance(transform.x, transform.y, target.x, target.y)
  const targetRadius = getSizeRadius(target.size)
  const myRadius = getSizeRadius(transform.size)
  const distEdge = distance - targetRadius - myRadius
  const positioning = getEcsPositioningDecision(world, entityId, targetId, distEdge, targetRadius, myRadius)
  syncEcsMovementIntentModes(world, entityId, positioning.shouldMove, actions)
  const effectiveSpeed = getEcsMovementSpeed(world, entityId)
  const steeringInRange = positioning.combatInRange && !positioning.shouldMove
  updateEcsStuckRecovery(world, entityId, targetId, distance, steeringInRange)
  const steering = getEcsSteeringContext(world, entityId, neighbors, myRadius, steeringInRange)
  const facingPoint = positioning.shouldMove ? positioning.point : target
  let targetAngle = identity.squadId && steering.squadCount > 1 && distance > combat.range * 1.5
    ? Math.atan2(positioning.point.y - steering.squadCy, positioning.point.x - steering.squadCx)
    : Math.atan2(facingPoint.y - transform.y, facingPoint.x - transform.x)
  let navigating = false

  if (!transform.isFlying && positioning.shouldMove && getDistance(transform.x, transform.y, positioning.point.x, positioning.point.y) > 20) {
    const flowAngle = getFlowVector(context.flowField, transform.x, transform.y, positioning.point.x, positioning.point.y)
    if (flowAngle !== null) {
      const directAngle = Math.atan2(positioning.point.y - transform.y, positioning.point.x - transform.x)
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

  const angleDiff = normalizeAngle(targetAngle - transform.currentAngle)
  const maxTurn = movement.turnSpeed * context.dt
  transform.currentAngle = Math.abs(angleDiff) <= maxTurn
    ? targetAngle
    : transform.currentAngle + Math.sign(angleDiff) * maxTurn
  transform.currentAngle = normalizeAngle(transform.currentAngle)

  if (effectiveSpeed <= 0) {
    transform.velocity.x = 0
    transform.velocity.y = 0
    movement.isMoving = false
    syncEcsMovementActivity(world, entityId, false, actions)
    if (Math.abs(angleDiff) > 0.2) {
      actions.push({
        unitId: identity.id, type: 'move', targetId: targetIdentity.id,
        fromX: round(transform.x), fromY: round(transform.y),
        toX: round(transform.x), toY: round(transform.y),
        facingAngle: round(transform.currentAngle), isWalking: false,
      })
    }
    return
  }

  if (steeringInRange) {
    movement.isMoving = false
    syncEcsMovementActivity(world, entityId, false, actions)
    let vx = steering.separationX
    let vy = steering.separationY
    if (!transform.isFlying) {
      const correction = getEcsObstacleCorrection(world, entityId, context.obstacles, myRadius, effectiveSpeed)
      vx += correction.x
      vy += correction.y
    }
    const magnitude = Math.hypot(vx, vy)
    if (magnitude <= 0.5) {
      transform.velocity.x = 0
      transform.velocity.y = 0
      emitMove(world, entityId, targetId, actions, transform.x, transform.y, angleDiff, false)
      return
    }
    const maxSpeed = Math.max(effectiveSpeed * 1.2, 12)
    if (magnitude > maxSpeed) {
      vx = (vx / magnitude) * maxSpeed
      vy = (vy / magnitude) * maxSpeed
    }
    const blend = Math.min(1, context.dt * 8)
    transform.velocity.x += (vx - transform.velocity.x) * blend
    transform.velocity.y += (vy - transform.velocity.y) * blend
    const finalMagnitude = Math.hypot(transform.velocity.x, transform.velocity.y)
    if (finalMagnitude > maxSpeed) {
      transform.velocity.x = (transform.velocity.x / finalMagnitude) * maxSpeed
      transform.velocity.y = (transform.velocity.y / finalMagnitude) * maxSpeed
    }
    const fromX = transform.x
    const fromY = transform.y
    transform.x = clamp(transform.x + transform.velocity.x * context.dt, 0, FIELD_WIDTH)
    transform.y = clamp(transform.y + transform.velocity.y * context.dt, 0, FIELD_HEIGHT)
    emitMove(world, entityId, targetId, actions, fromX, fromY, angleDiff, false)
    return
  }

  let vx = 0
  let vy = 0
  movement.isMoving = positioning.shouldMove
  syncEcsMovementActivity(world, entityId, positioning.shouldMove, actions)
  if (positioning.shouldMove) {
    vx = Math.cos(transform.currentAngle) * effectiveSpeed
    vy = Math.sin(transform.currentAngle) * effectiveSpeed
  }
  if (!transform.isFlying) {
    const correction = getEcsObstacleCorrection(world, entityId, context.obstacles, myRadius, effectiveSpeed)
    vx += correction.x
    vy += correction.y
  }
  const cohesion = getEcsFormationForce(world, entityId, positioning.point, steering.squadCx, steering.squadCy, steering.squadCount, distEdge, navigating)
  vx += cohesion.x
  vy += cohesion.y
  vx += steering.separationX + steering.alignmentX
  vy += steering.separationY + steering.alignmentY
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
  const nextX = clamp(transform.x + transform.velocity.x * context.dt, 0, FIELD_WIDTH)
  const nextY = clamp(transform.y + transform.velocity.y * context.dt, 0, FIELD_HEIGHT)
  if (Math.hypot(nextX - transform.x, nextY - transform.y) > 0.1 || Math.abs(angleDiff) > 0.2) {
    const fromX = transform.x
    const fromY = transform.y
    transform.x = nextX
    transform.y = nextY
    recordEcsChargeMovement(world, entityId, Math.hypot(nextX - fromX, nextY - fromY))
    emitMove(world, entityId, targetId, actions, fromX, fromY, angleDiff, movement.isMoving ?? false)
  }
}

function emitMove(world: CombatWorld, entityId: EntityId, targetId: EntityId, actions: BattleAction[], fromX: number, fromY: number, angleDiff: number, walking: boolean): void {
  const identity = world.stores.identity.require(entityId)
  const target = world.stores.identity.require(targetId)
  const transform = world.stores.transform.require(entityId)
  const displacement = Math.hypot(transform.x - fromX, transform.y - fromY)
  if (displacement <= 0.1 && Math.abs(angleDiff) <= 0.2) return
  actions.push({
    unitId: identity.id, type: 'move', targetId: target.id,
    fromX: round(fromX), fromY: round(fromY), toX: round(transform.x), toY: round(transform.y),
    facingAngle: round(transform.currentAngle), isWalking: walking,
    motionKind: displacement <= 0.1 ? 'turn' : walking ? 'locomotion' : 'steering',
  })
}

function blendVelocity(velocity: { x: number; y: number }, vx: number, vy: number, dt: number, maxSpeed: number): void {
  const blend = Math.min(1, dt * 8)
  velocity.x += (vx - velocity.x) * blend
  velocity.y += (vy - velocity.y) * blend
  clampVelocity(velocity, maxSpeed)
}

function clampVelocity(velocity: { x: number; y: number }, maxSpeed: number): void {
  const magnitude = Math.hypot(velocity.x, velocity.y)
  if (magnitude < 0.5) {
    velocity.x = 0
    velocity.y = 0
  } else if (magnitude > maxSpeed) {
    velocity.x = (velocity.x / magnitude) * maxSpeed
    velocity.y = (velocity.y / magnitude) * maxSpeed
  }
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)) }
function round(value: number): number { return Math.round(value * 100) / 100 }
