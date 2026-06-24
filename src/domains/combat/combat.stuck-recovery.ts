import type { Obstacle, SimUnit } from './combat.sim.types'
import { getDistance, getSizeRadius } from './combat.utils'

const STUCK_PROGRESS_EPSILON = 1.5
const STUCK_TICK_THRESHOLD = 8
const AVOIDANCE_TICKS = 14
const AVOIDANCE_FORCE_MULT = 0.8
const OBSTACLE_INFLUENCE_PADDING = 70

export interface StuckRecoveryContext {
  forceX: number
  forceY: number
  isRecovering: boolean
}

export function updateStuckRecovery(unit: SimUnit, target: SimUnit, distanceToTarget: number, isInRange: boolean): void {
  if (unit.isFlying || isInRange || unit.speed <= 0) {
    resetStuckRecovery(unit)
    return
  }

  if (unit.lastProgressTargetId !== target.id) {
    unit.lastProgressTargetId = target.id
    unit.lastTargetDistance = distanceToTarget
    unit.stuckTicks = 0
    unit.avoidanceTicks = 0
    return
  }

  const previousDistance = unit.lastTargetDistance ?? distanceToTarget
  const progress = previousDistance - distanceToTarget
  unit.lastTargetDistance = distanceToTarget
  unit.lastProgressX = unit.x
  unit.lastProgressY = unit.y

  if (progress > STUCK_PROGRESS_EPSILON) {
    unit.stuckTicks = 0
    if ((unit.avoidanceTicks ?? 0) > 0) unit.avoidanceTicks = Math.max(0, (unit.avoidanceTicks ?? 0) - 2)
    return
  }

  unit.stuckTicks = (unit.stuckTicks ?? 0) + 1
  if (unit.stuckTicks >= STUCK_TICK_THRESHOLD) {
    unit.avoidanceSide = unit.avoidanceSide ?? getDeterministicAvoidanceSide(unit.id, target.id)
    unit.avoidanceTicks = AVOIDANCE_TICKS
  } else if ((unit.avoidanceTicks ?? 0) > 0) {
    unit.avoidanceTicks = Math.max(0, (unit.avoidanceTicks ?? 0) - 1)
  }
}

export function getStuckRecoveryForce(unit: SimUnit, target: SimUnit, obstacles: Obstacle[]): StuckRecoveryContext {
  if ((unit.avoidanceTicks ?? 0) <= 0 || unit.isFlying) return { forceX: 0, forceY: 0, isRecovering: false }

  unit.avoidanceTicks = Math.max(0, (unit.avoidanceTicks ?? 0) - 1)
  const obstacle = findNearestInfluencingObstacle(unit, obstacles)
  const side = unit.avoidanceSide ?? getDeterministicAvoidanceSide(unit.id, target.id)

  if (!obstacle) {
    const directX = target.x - unit.x
    const directY = target.y - unit.y
    const mag = Math.max(1, Math.hypot(directX, directY))
    return {
      forceX: (-directY / mag) * side * unit.speed * 0.45,
      forceY: (directX / mag) * side * unit.speed * 0.45,
      isRecovering: true,
    }
  }

  const awayX = unit.x - obstacle.x
  const awayY = unit.y - obstacle.y
  const mag = Math.max(1, Math.hypot(awayX, awayY))
  const tangentX = (-awayY / mag) * side
  const tangentY = (awayX / mag) * side
  const distance = getDistance(unit.x, unit.y, obstacle.x, obstacle.y)
  const influence = Math.max(0.25, 1 - distance / (obstacle.radius + getSizeRadius(unit.size) + OBSTACLE_INFLUENCE_PADDING))

  return {
    forceX: tangentX * unit.speed * AVOIDANCE_FORCE_MULT * influence,
    forceY: tangentY * unit.speed * AVOIDANCE_FORCE_MULT * influence,
    isRecovering: true,
  }
}

function resetStuckRecovery(unit: SimUnit): void {
  unit.stuckTicks = 0
  unit.avoidanceTicks = 0
  unit.lastTargetDistance = undefined
  unit.lastProgressTargetId = undefined
}

function findNearestInfluencingObstacle(unit: SimUnit, obstacles: Obstacle[]): Obstacle | null {
  let best: Obstacle | null = null
  let bestDistance = Infinity
  const unitRadius = getSizeRadius(unit.size)

  for (const obstacle of obstacles) {
    const distance = getDistance(unit.x, unit.y, obstacle.x, obstacle.y)
    const influenceRadius = obstacle.radius + unitRadius + OBSTACLE_INFLUENCE_PADDING
    if (distance <= influenceRadius && distance < bestDistance) {
      best = obstacle
      bestDistance = distance
    }
  }

  return best
}

function getDeterministicAvoidanceSide(unitId: string, targetId: string): -1 | 1 {
  let hash = 2166136261
  const value = `${unitId}:${targetId}`
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 2 === 0 ? -1 : 1
}
