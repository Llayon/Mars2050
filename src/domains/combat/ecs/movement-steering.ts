import type { Obstacle } from '../combat.sim.types'
import { getDistance, getSizeMass, getSizeRadius } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { getEcsEffectiveActionRange } from './movement-positioning'

export const ECS_MOVEMENT_NEIGHBOR_RADIUS = 220
export const ECS_MOVEMENT_DENSE_NEIGHBOR_RADIUS = 120
export const ECS_MOVEMENT_MAX_NEIGHBORS = 64
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
  neighbors: EntityId[],
  myRadius: number,
  isInRange: boolean,
): EcsSteeringContext {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const isBug = identity.type.startsWith('alien_')
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

  for (const otherId of neighbors) {
    if (otherId === entityId) continue
    const otherIdentity = identityStore.get(otherId)!
    const other = transformStore.get(otherId)!
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
      const direction = getAwayVector(identity.id, otherIdentity.id, transform, other, dist)
      const soft = Math.max(0, (separateRadius - dist) / separateRadius)
      const emergency = dist < minDist
        ? getEmergencyPush(transform.size, other.size, myRadius, otherRadius, dist, combat.speed, isInRange)
        : 0
      const massRatio = getSizeMass(other.size) / getSizeMass(transform.size)
      const force = soft * soft * combat.speed * SEPARATION_WEIGHT * (isInRange ? 0.15 : 1) *
        Math.max(0.08, Math.min(1.25, Math.sqrt(massRatio))) + emergency * (isInRange ? 0.3 : 0.55)
      separationX += direction.x * force
      separationY += direction.y * force
    }
    if (!isInRange && distanceSq > 0 && distanceSq <= ALIGNMENT_RADIUS * ALIGNMENT_RADIUS) {
      const speed = Math.hypot(other.velocity.x, other.velocity.y)
      if (speed > 0.1) {
        alignmentX += other.velocity.x / speed
        alignmentY += other.velocity.y / speed
        alignmentCount++
      } else if (isBug && otherIdentity.type.startsWith('alien_')) {
        alignmentX += Math.cos(other.currentAngle)
        alignmentY += Math.sin(other.currentAngle)
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
): { x: number; y: number } {
  if (squadCount <= 1) return { x: 0, y: 0 }
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const isBug = identity.type.startsWith('alien_')
  const near = distEdge <= getEcsEffectiveActionRange(world, entityId) + Math.max(70, getSizeRadius(transform.size) * 2)
  const threshold = isBug ? 60 : near ? 36 : 14
  const anchor = getFormationAnchor(transform, targetPoint, squadCx, squadCy, isBug)
  const distance = getDistance(transform.x, transform.y, anchor.x, anchor.y)
  if (distance <= threshold) return { x: 0, y: 0 }
  const angle = Math.atan2(anchor.y - transform.y, anchor.x - transform.x)
  const multiplier = navigating ? 0.1 : isBug ? 0.5 : near ? 0.18 : 0.75
  const pull = combat.speed * multiplier
  return { x: Math.cos(angle) * pull, y: Math.sin(angle) * pull }
}

export function getEcsObstacleCorrection(
  world: CombatWorld,
  entityId: EntityId,
  obstacles: Obstacle[],
  myRadius: number,
  effectiveSpeed: number,
): { x: number; y: number } {
  const transform = world.stores.transform.require(entityId)
  let x = 0
  let y = 0
  for (const obstacle of obstacles) {
    const dist = getDistance(transform.x, transform.y, obstacle.x, obstacle.y)
    const minDist = myRadius + obstacle.radius
    if (dist <= 0 || dist >= minDist) continue
    const overlap = minDist - dist
    const angle = Math.atan2(transform.y - obstacle.y, transform.x - obstacle.x)
    const force = Math.min(overlap * 2.5, Math.max(10, effectiveSpeed * 0.6))
    x += Math.cos(angle) * force
    y += Math.sin(angle) * force
  }
  return { x, y }
}

function getFormationAnchor(
  transform: { offsetX?: number; offsetY?: number; initialAngle?: number },
  target: { x: number; y: number },
  squadCx: number,
  squadCy: number,
  isBug: boolean,
): { x: number; y: number } {
  if (isBug || transform.offsetX === undefined || transform.offsetY === undefined || transform.initialAngle === undefined) return { x: squadCx, y: squadCy }
  const squadAngle = Math.atan2(target.y - squadCy, target.x - squadCx)
  const rotation = squadAngle - transform.initialAngle
  const rotatedX = transform.offsetX * Math.cos(rotation) - transform.offsetY * Math.sin(rotation)
  const rotatedY = transform.offsetX * Math.sin(rotation) + transform.offsetY * Math.cos(rotation)
  return {
    x: squadCx + rotatedX,
    y: squadCy + rotatedY,
  }
}

function getAwayVector(
  unitId: string,
  otherId: string,
  unit: { x: number; y: number },
  other: { x: number; y: number },
  distance: number,
): { x: number; y: number } {
  if (distance > 0) return { x: (unit.x - other.x) / distance, y: (unit.y - other.y) / distance }
  let hash = 2166136261
  const value = unitId < otherId ? `${unitId}:${otherId}` : `${otherId}:${unitId}`
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const angle = ((hash >>> 0) / 4294967295) * Math.PI * 2 + (unitId < otherId ? 0 : Math.PI)
  return { x: Math.cos(angle), y: Math.sin(angle) }
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
