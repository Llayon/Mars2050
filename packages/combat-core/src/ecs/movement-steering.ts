import { deterministicSin, deterministicCos, deterministicAtan2 } from '../math/deterministic-trig.js'
import type { Obstacle } from '../combat.sim.types.js'
import { getDistance, getSizeMass, getSizeRadius } from '../combat.utils.js'
import type { CombatWorld } from './combat-world.js'
import type { EntityId } from './entity.js'
import { getEcsEffectiveActionRange } from './movement-positioning.js'
import type { FrozenMovementTransform, MovementFrame } from './movement-batch.types.js'

export const ECS_MOVEMENT_NEIGHBOR_RADIUS = 220
export const ECS_MOVEMENT_DENSE_NEIGHBOR_RADIUS = 120
export const ECS_MOVEMENT_DENSE_TEAM_THRESHOLD = 64
export const ECS_MOVEMENT_MAX_NEIGHBORS = 32
const SEPARATION_RADIUS_MULT = 1.2
const SEPARATION_WEIGHT = 0.25
const ALIGNMENT_RADIUS = 120
const ALIGNMENT_WEIGHT = 0.25

export interface EcsSteeringContext {
  squadCx: number
  squadCy: number
  squadCount: number
  separationX: number
  separationY: number
  alignmentX: number
  alignmentY: number
}

export function getEcsSteeringContext(
  world: CombatWorld,
  entityId: EntityId,
  neighbors: ArrayLike<EntityId>,
  myRadius: number,
  isInRange: boolean,
  frame?: MovementFrame,
): EcsSteeringContext {
  const identity = world.stores.identity.require(entityId)
  const transform = getMovementTransform(world, entityId, frame)
  const combat = world.stores.combat.require(entityId)
  const rulesStore = world.stores.runtimeRules
  const stationaryAlignment = rulesStore.get(entityId)?.stationaryAlignment === true
  let squadCx = identity.squadId ? transform.x : 0
  let squadCy = identity.squadId ? transform.y : 0
  let squadCount = identity.squadId ? 1 : 0
  let separationX = 0
  let separationY = 0
  let alignmentX = 0
  let alignmentY = 0
  let alignmentCount = 0
  const identityStore = world.stores.identity
  const transformStore = world.stores.transform

  for (let neighborIndex = 0; neighborIndex < neighbors.length; neighborIndex++) {
    const otherId = neighbors[neighborIndex]
    if (otherId === entityId) continue
    const otherIdentity = identityStore.get(otherId)!
    const other = frame?.transforms[otherId] ?? transformStore.get(otherId)!
    if (identity.squadId && otherIdentity.squadId === identity.squadId) {
      squadCx += other.x
      squadCy += other.y
      squadCount++
    }
    if (transform.isFlying !== other.isFlying) continue
    const otherRadius = getSizeRadius(other.size)
    const dx = transform.x - other.x
    const dy = transform.y - other.y
    const distanceSq = dx * dx + dy * dy
    const minDist = (myRadius + otherRadius) * 0.95
    const separateRadius = Math.max(minDist * SEPARATION_RADIUS_MULT, 45)
    if (!transform.isFlying && distanceSq < separateRadius * separateRadius) {
      const dist = getDistance(transform.x, transform.y, other.x, other.y)
      // The separation direction is consumed inside this iteration, so keep it in locals instead
      // of allocating a { x, y } vector for every overlapping neighbour of every moving unit.
      let directionX: number
      let directionY: number
      if (dist > 0) {
        directionX = (transform.x - other.x) / dist
        directionY = (transform.y - other.y) / dist
      } else {
        const angle = getAwayAngle(identity.id, otherIdentity.id)
        directionX = deterministicCos(angle)
        directionY = deterministicSin(angle)
      }
      const soft = Math.max(0, (separateRadius - dist) / separateRadius)
      const emergency = dist < minDist
        ? getEmergencyPush(transform.size, other.size, myRadius, otherRadius, dist, combat.speed, isInRange)
        : 0
      const massRatio = getSizeMass(other.size) / getSizeMass(transform.size)
      const force = soft * soft * combat.speed * SEPARATION_WEIGHT * (isInRange ? 0.15 : 1) *
        Math.max(0.08, Math.min(1.25, Math.sqrt(massRatio))) + emergency * (isInRange ? 0.3 : 0.55)
      separationX += directionX * force
      separationY += directionY * force
    }
    if (!isInRange && distanceSq > 0 && distanceSq <= ALIGNMENT_RADIUS * ALIGNMENT_RADIUS) {
      const velocityX = 'velocityX' in other ? other.velocityX : other.velocity.x
      const velocityY = 'velocityY' in other ? other.velocityY : other.velocity.y
      const speed = Math.hypot(velocityX, velocityY)
      if (speed > 0.1) {
        alignmentX += velocityX / speed
        alignmentY += velocityY / speed
        alignmentCount++
      } else if (stationaryAlignment && rulesStore.get(otherId)?.stationaryAlignment === true) {
        alignmentX += deterministicCos(other.currentAngle)
        alignmentY += deterministicSin(other.currentAngle)
        alignmentCount++
      }
    }
  }
  if (squadCount > 1) {
    squadCx /= squadCount
    squadCy /= squadCount
  }
  if (alignmentCount > 0) {
    alignmentX = (alignmentX / alignmentCount) * combat.speed * ALIGNMENT_WEIGHT
    alignmentY = (alignmentY / alignmentCount) * combat.speed * ALIGNMENT_WEIGHT
  }
  return { squadCx, squadCy, squadCount, separationX, separationY, alignmentX, alignmentY }
}

export function getEcsFormationForce(
  world: CombatWorld,
  entityId: EntityId,
  targetPoint: { x: number; y: number },
  squadCx: number,
  squadCy: number,
  squadCount: number,
  distEdge: number,
  navigating: boolean,
  frame?: MovementFrame,
): { x: number; y: number } {
  if (squadCount <= 1) return { x: 0, y: 0 }
  const transform = getMovementTransform(world, entityId, frame)
  const combat = world.stores.combat.require(entityId)
  const rules = world.stores.runtimeRules.get(entityId)
  const isCentroidAnchor = rules?.formationAnchorMode === 'centroid'
  const near = distEdge <= getEcsEffectiveActionRange(world, entityId) + Math.max(70, getSizeRadius(transform.size) * 2)
  const threshold = isCentroidAnchor ? 60 : near ? 36 : 14
  const anchor = getFormationAnchor(transform, targetPoint, squadCx, squadCy, isCentroidAnchor)
  const distance = getDistance(transform.x, transform.y, anchor.x, anchor.y)
  if (distance <= threshold) return { x: 0, y: 0 }
  const angle = deterministicAtan2(anchor.y - transform.y, anchor.x - transform.x)
  const multiplier = navigating ? 0.1 : isCentroidAnchor ? 0.5 : near ? 0.18 : 0.75
  const pull = combat.speed * multiplier
  return { x: deterministicCos(angle) * pull, y: deterministicSin(angle) * pull }
}

export function getEcsObstacleCorrection(
  world: CombatWorld,
  entityId: EntityId,
  obstacles: Obstacle[],
  myRadius: number,
  effectiveSpeed: number,
  frame?: MovementFrame,
): { x: number; y: number } {
  const transform = getMovementTransform(world, entityId, frame)
  let x = 0
  let y = 0
  for (const obstacle of obstacles) {
    const dist = getDistance(transform.x, transform.y, obstacle.x, obstacle.y)
    const minDist = myRadius + obstacle.radius
    if (dist <= 0 || dist >= minDist) continue
    const overlap = minDist - dist
    const angle = deterministicAtan2(transform.y - obstacle.y, transform.x - obstacle.x)
    const force = Math.min(overlap * 2.5, Math.max(10, effectiveSpeed * 0.6))
    x += deterministicCos(angle) * force
    y += deterministicSin(angle) * force
  }
  return { x, y }
}

function getFormationAnchor(
  transform: { offsetX?: number; offsetY?: number; initialAngle?: number },
  target: { x: number; y: number },
  squadCx: number,
  squadCy: number,
  isCentroidAnchor: boolean,
): { x: number; y: number } {
  if (isCentroidAnchor || transform.offsetX === undefined || transform.offsetY === undefined || transform.initialAngle === undefined) return { x: squadCx, y: squadCy }
  const squadAngle = deterministicAtan2(target.y - squadCy, target.x - squadCx)
  const rotation = squadAngle - transform.initialAngle
  const rotatedX = transform.offsetX * deterministicCos(rotation) - transform.offsetY * deterministicSin(rotation)
  const rotatedY = transform.offsetX * deterministicSin(rotation) + transform.offsetY * deterministicCos(rotation)
  return {
    x: squadCx + rotatedX,
    y: squadCy + rotatedY,
  }
}

/**
 * Deterministic fallback direction for perfectly overlapping units, derived from the ordered pair
 * of external unit ids. Returns the angle only: the caller builds the two vector components
 * locally, which keeps this per-neighbour path allocation free.
 * @param unitId External id of the moving unit
 * @param otherId External id of the neighbour occupying the same point
 * @returns Angle in radians, mirrored for the reversed pair order
 */
function getAwayAngle(unitId: string, otherId: string): number {
  let hash = 2166136261
  const value = unitId < otherId ? `${unitId}:${otherId}` : `${otherId}:${unitId}`
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) / 4294967295) * Math.PI * 2 + (unitId < otherId ? 0 : Math.PI)
}

function getEmergencyPush(
  unitSize: 'S' | 'M' | 'L' | 'XL',
  otherSize: 'S' | 'M' | 'L' | 'XL',
  myRadius: number,
  otherRadius: number,
  distance: number,
  speed: number,
  isInRange: boolean,
): number {
  const overlap = Math.max(0, (myRadius + otherRadius) * 0.95 - distance)
  const ratio = getSizeMass(otherSize) / (getSizeMass(unitSize) + getSizeMass(otherSize))
  return Math.min(overlap * 1.2, speed * 0.9) * ratio * (isInRange ? 0.45 : 0.65)
}

function getMovementTransform(
  world: CombatWorld,
  entityId: EntityId,
  frame?: MovementFrame,
): FrozenMovementTransform | ReturnType<CombatWorld['stores']['transform']['require']> {
  return frame?.transforms[entityId] ?? world.stores.transform.require(entityId)
}
