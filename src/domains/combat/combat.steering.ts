import type { SimUnit } from './combat.sim.types'
import { getDistance, getSizeMass, getSizeRadius } from './combat.utils'
import type { SpatialHash } from './spatial-hash'

export const MOVEMENT_NEIGHBOR_RADIUS = 220

const SEPARATION_RADIUS_MULT = 1.2
const SEPARATION_WEIGHT = 0.25
const ALIGNMENT_RADIUS = 120
const ALIGNMENT_WEIGHT = 0.25

export interface SteeringContext {
  squadCx: number
  squadCy: number
  squadCount: number
  separationX: number
  separationY: number
  alignmentX: number
  alignmentY: number
}

export function getMovementNeighbors(unit: SimUnit, units: SimUnit[], spatialHash?: SpatialHash): SimUnit[] {
  return spatialHash?.query(unit.x, unit.y, MOVEMENT_NEIGHBOR_RADIUS) ?? units
}

export function getSteeringContext(unit: SimUnit, neighbors: SimUnit[], myRadius: number, isInRange: boolean): SteeringContext {
  const isBug = unit.type.startsWith('alien_')
  let squadCx = unit.squadId ? unit.x : 0
  let squadCy = unit.squadId ? unit.y : 0
  let squadCount = unit.squadId ? 1 : 0
  let separationX = 0
  let separationY = 0
  let alignmentX = 0
  let alignmentY = 0
  let alignmentCount = 0

  for (const other of neighbors) {
    if (other.isDead || other.id === unit.id) continue

    if (unit.squadId && other.squadId === unit.squadId) {
      squadCx += other.x
      squadCy += other.y
      squadCount++
    }

    if (unit.isFlying !== other.isFlying) continue

    const otherRadius = getSizeRadius(other.size)
    const dist = getDistance(unit.x, unit.y, other.x, other.y)
    const minDist = (myRadius + otherRadius) * 0.95
    const separateRadius = Math.max(minDist * SEPARATION_RADIUS_MULT, 45)

    if (!unit.isFlying && other.team === unit.team && dist < separateRadius) {
      const direction = getAwayVector(unit, other, dist)
      const soft = Math.max(0, (separateRadius - dist) / separateRadius)
      const emergency = dist < minDist ? getEmergencyPush(unit, other, myRadius, otherRadius, dist, isInRange) : 0
      const force = soft * soft * unit.speed * SEPARATION_WEIGHT * getSoftSeparationMultiplier(isInRange) * getSeparationMassMultiplier(unit, other) +
        emergency * getEmergencySeparationMultiplier(isInRange)

      separationX += direction.x * force
      separationY += direction.y * force
    }

    if (!isInRange && other.team === unit.team && dist > 0 && dist <= ALIGNMENT_RADIUS) {
      const vx = other.velocity.x
      const vy = other.velocity.y
      const speed = Math.hypot(vx, vy)
      if (speed > 0.1) {
        alignmentX += vx / speed
        alignmentY += vy / speed
        alignmentCount++
      } else if (isBug && other.type.startsWith('alien_')) {
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
    alignmentX = (alignmentX / alignmentCount) * unit.speed * ALIGNMENT_WEIGHT
    alignmentY = (alignmentY / alignmentCount) * unit.speed * ALIGNMENT_WEIGHT
  }

  return { squadCx, squadCy, squadCount, separationX, separationY, alignmentX, alignmentY }
}

function getAwayVector(unit: SimUnit, other: SimUnit, dist: number): { x: number; y: number } {
  if (dist > 0) {
    return {
      x: (unit.x - other.x) / dist,
      y: (unit.y - other.y) / dist
    }
  }

  const angle = getDeterministicPairAngle(unit.id, other.id)
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

function getEmergencyPush(unit: SimUnit, other: SimUnit, myRadius: number, otherRadius: number, dist: number, isInRange: boolean): number {
  const minDist = (myRadius + otherRadius) * 0.95
  const overlap = Math.max(0, minDist - dist)
  const myMass = getSizeMass(unit.size)
  const otherMass = getSizeMass(other.size)
  const pushRatio = otherMass / (myMass + otherMass)
  const stanceMultiplier = isInRange ? 0.45 : 0.65
  return Math.min(overlap * 1.2, unit.speed * 0.9) * pushRatio * stanceMultiplier
}

function getSoftSeparationMultiplier(isInRange: boolean): number {
  return isInRange ? 0.15 : 1
}

function getEmergencySeparationMultiplier(isInRange: boolean): number {
  return isInRange ? 0.3 : 0.55
}

function getSeparationMassMultiplier(unit: SimUnit, other: SimUnit): number {
  const ratio = getSizeMass(other.size) / getSizeMass(unit.size)
  return Math.max(0.08, Math.min(1.25, Math.sqrt(ratio)))
}

function getDeterministicPairAngle(unitId: string, otherId: string): number {
  const angle = getDeterministicAngle(unitId, otherId)
  return unitId < otherId ? angle : angle + Math.PI
}

function getDeterministicAngle(a: string, b: string): number {
  let hash = 2166136261
  const value = a < b ? `${a}:${b}` : `${b}:${a}`
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) / 4294967295) * Math.PI * 2
}
