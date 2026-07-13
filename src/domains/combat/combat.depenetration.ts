import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'
import { FIELD_HEIGHT, FIELD_WIDTH, getSizeMass, getSizeRadius } from './combat.utils'

interface IndexedUnit {
  unit: SimUnit
  index: number
}

interface CollisionPair {
  first: IndexedUnit
  second: IndexedUnit
}

const MAX_PAIR_DISTANCE = (getSizeRadius('XL') + getSizeRadius('XL')) * 0.95
const NEIGHBOR_OFFSETS = [-1, 0, 1] as const
const SAME_TEAM_CORRECTION = 0.64
const ENEMY_CORRECTION = 0.28
const MAX_CORRECTION_PER_TICK = 4.8
const MIN_EMIT_DISTANCE = 0.1
const INWARD_VELOCITY_DAMPING = 0.85

export function applyDepenetration(units: SimUnit[], actions: BattleAction[]): void {
  const pairs = getCollisionPairs(units)
  if (pairs.length === 0) return

  const corrections = new Map<SimUnit, { x: number; y: number }>()

  for (const pair of pairs) {
    const first = pair.first.unit
    const second = pair.second.unit
    if (first.isDead || second.isDead || first.isFlying !== second.isFlying) continue

    const firstRadius = getSizeRadius(first.size)
    const secondRadius = getSizeRadius(second.size)
    const minDistance = (firstRadius + secondRadius) * 0.95
    const dx = second.x - first.x
    const dy = second.y - first.y
    const distance = Math.hypot(dx, dy)
    const overlap = Math.max(0, minDistance - distance)
    if (overlap <= 0) continue

    const direction = distance > 0
      ? { x: dx / distance, y: dy / distance }
      : getDeterministicPairVector(first.id, second.id)
    const correction = Math.min(
      overlap * (first.team === second.team ? SAME_TEAM_CORRECTION : ENEMY_CORRECTION),
      MAX_CORRECTION_PER_TICK
    )
    applyPairCorrection(first, second, direction, correction, corrections)
    dampPairInwardVelocity(first, second, direction)
  }

  for (const [unit, correction] of corrections) {
    const mag = Math.hypot(correction.x, correction.y)
    if (mag <= MIN_EMIT_DISTANCE) continue

    const fromX = unit.x
    const fromY = unit.y
    unit.x = clamp(unit.x + correction.x, 0, FIELD_WIDTH)
    unit.y = clamp(unit.y + correction.y, 0, FIELD_HEIGHT)
    if (Math.hypot(unit.x - fromX, unit.y - fromY) <= MIN_EMIT_DISTANCE) continue
    actions.push({
      unitId: unit.id,
      type: 'move',
      fromX: round(fromX),
      fromY: round(fromY),
      toX: round(unit.x),
      toY: round(unit.y),
      facingAngle: round(unit.currentAngle),
      isWalking: false,
      motionKind: 'depenetration',
    })
  }
}

function applyPairCorrection(
  first: SimUnit,
  second: SimUnit,
  direction: { x: number; y: number },
  correction: number,
  corrections: Map<SimUnit, { x: number; y: number }>
): void {
  const firstCanMove = canDepenetrate(first)
  const secondCanMove = canDepenetrate(second)
  if (!firstCanMove && !secondCanMove) return

  const firstMass = getSizeMass(first.size)
  const secondMass = getSizeMass(second.size)
  const firstShare = !firstCanMove ? 0 : secondCanMove ? secondMass / (firstMass + secondMass) : 1
  const secondShare = !secondCanMove ? 0 : firstCanMove ? firstMass / (firstMass + secondMass) : 1

  addCorrection(corrections, first, -direction.x * correction * firstShare, -direction.y * correction * firstShare)
  addCorrection(corrections, second, direction.x * correction * secondShare, direction.y * correction * secondShare)
}

function dampPairInwardVelocity(first: SimUnit, second: SimUnit, direction: { x: number; y: number }): void {
  if (canDampDepenetrationVelocity(first)) dampInwardVelocity(first, direction.x, direction.y)
  if (canDampDepenetrationVelocity(second)) dampInwardVelocity(second, -direction.x, -direction.y)
}

function dampInwardVelocity(unit: SimUnit, inwardX: number, inwardY: number): void {
  const inwardSpeed = unit.velocity.x * inwardX + unit.velocity.y * inwardY
  if (inwardSpeed <= 0) return
  unit.velocity.x -= inwardX * inwardSpeed * INWARD_VELOCITY_DAMPING
  unit.velocity.y -= inwardY * inwardSpeed * INWARD_VELOCITY_DAMPING
}

function canDampDepenetrationVelocity(unit: SimUnit): boolean {
  return canDepenetrate(unit) && (unit.range > 60 || unit.type.startsWith('alien_'))
}

function canDepenetrate(unit: SimUnit): boolean {
  return unit.speed > 0 && unit.stanceMode !== 'deployed' && unit.isBurrowed !== true
}

function addCorrection(corrections: Map<SimUnit, { x: number; y: number }>, unit: SimUnit, x: number, y: number): void {
  const current = corrections.get(unit) ?? { x: 0, y: 0 }
  const next = clampVector({ x: current.x + x, y: current.y + y }, MAX_CORRECTION_PER_TICK)
  corrections.set(unit, next)
}

function getCollisionPairs(units: SimUnit[]): CollisionPair[] {
  const buckets = new Map<string, IndexedUnit[]>()
  for (let index = 0; index < units.length; index++) {
    const unit = units[index]
    if (unit.isDead) continue
    const indexed = { unit, index }
    const key = getBucketKey(unit.x, unit.y)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(indexed)
    else buckets.set(key, [indexed])
  }

  const pairs: CollisionPair[] = []
  for (const bucket of buckets.values()) {
    for (const first of bucket) {
      for (const second of getNearbyUnits(first, buckets)) {
        if (second.index > first.index) pairs.push({ first, second })
      }
    }
  }

  return pairs.sort((a, b) => a.first.index - b.first.index || a.second.index - b.second.index)
}

function getNearbyUnits(unit: IndexedUnit, buckets: Map<string, IndexedUnit[]>): IndexedUnit[] {
  const cellX = getCellCoordinate(unit.unit.x)
  const cellY = getCellCoordinate(unit.unit.y)
  const units: IndexedUnit[] = []
  for (const offsetY of NEIGHBOR_OFFSETS) {
    for (const offsetX of NEIGHBOR_OFFSETS) {
      const bucket = buckets.get(`${cellX + offsetX}:${cellY + offsetY}`)
      if (bucket) units.push(...bucket)
    }
  }
  return units
}

function getBucketKey(x: number, y: number): string {
  return `${getCellCoordinate(x)}:${getCellCoordinate(y)}`
}

function getCellCoordinate(value: number): number {
  return Math.floor(value / MAX_PAIR_DISTANCE)
}

function getDeterministicPairVector(firstId: string, secondId: string): { x: number; y: number } {
  const angle = getDeterministicAngle(firstId, secondId)
  const directedAngle = firstId < secondId ? angle : angle + Math.PI
  return { x: Math.cos(directedAngle), y: Math.sin(directedAngle) }
}

function getDeterministicAngle(firstId: string, secondId: string): number {
  let hash = 2166136261
  const value = firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) / 4294967295) * Math.PI * 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clampVector(vector: { x: number; y: number }, max: number): { x: number; y: number } {
  const mag = Math.hypot(vector.x, vector.y)
  if (mag <= max) return vector
  return { x: (vector.x / mag) * max, y: (vector.y / mag) * max }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
