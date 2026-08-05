import { FIELD_HEIGHT, FIELD_WIDTH, getSizeMass, getSizeRadius } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import type { MovementFrame, MovementIntent } from './movement-batch.types'
import { buildMovementCollisionPairs } from './movement-collision-pairs'

const MAX_PAIR_DISTANCE = (getSizeRadius('XL') + getSizeRadius('XL')) * 0.95
const PAIR_SEARCH_DISTANCE = MAX_PAIR_DISTANCE + 9.6
const SAME_TEAM_CORRECTION = 0.64
const ENEMY_CORRECTION = 0.28
const MAX_CORRECTION = 4.8
const VELOCITY_DAMPING = 0.85
const SOLVER_PASSES = 1

export interface BatchCollisionResult {
  x: readonly number[]
  y: readonly number[]
  velocityX: readonly number[]
  velocityY: readonly number[]
  corrected: ReadonlySet<EntityId>
  candidatePairCount: number
  overlapPairCount: number
}

export function solveBatchMovementCollisions(
  world: CombatWorld,
  frame: MovementFrame,
  intents: readonly MovementIntent[],
  dirtyEntities: ReadonlySet<EntityId>,
): BatchCollisionResult {
  const x: number[] = []
  const y: number[] = []
  const velocityX: number[] = []
  const velocityY: number[] = []
  const turnLocked = new Set(intents.filter(intent => intent.requestKind === 'turn').map(intent => intent.entityId))
  for (const entityId of frame.entityIds) {
    const transform = frame.transforms[entityId]!
    x[entityId] = transform.x
    y[entityId] = transform.y
    velocityX[entityId] = transform.velocityX
    velocityY[entityId] = transform.velocityY
  }
  for (const intent of intents) {
    x[intent.entityId] = intent.toX
    y[intent.entityId] = intent.toY
    velocityX[intent.entityId] = intent.velocityX
    velocityY[intent.entityId] = intent.velocityY
  }

  const pairs = buildMovementCollisionPairs(
    frame.entityIds,
    x,
    y,
    dirtyEntities,
    PAIR_SEARCH_DISTANCE,
  )
  const corrected = new Set<EntityId>()
  let overlapPairCount = 0
  for (let pass = 0; pass < SOLVER_PASSES; pass++) {
    const correctionX: number[] = []
    const correctionY: number[] = []
    const velocityDeltaX: number[] = []
    const velocityDeltaY: number[] = []
    for (const [firstId, secondId] of pairs) {
      const first = frame.transforms[firstId]!
      const second = frame.transforms[secondId]!
      if (first.isFlying !== second.isFlying) continue
      const dx = x[secondId] - x[firstId]
      const dy = y[secondId] - y[firstId]
      const minDistance = (getSizeRadius(first.size) + getSizeRadius(second.size)) * 0.95
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared >= minDistance * minDistance) continue
      if (pass === 0) overlapPairCount++
      const distance = Math.hypot(dx, dy)
      const direction = distance > 0
        ? { x: dx / distance, y: dy / distance }
        : getPairVector(world, firstId, secondId)
      const overlap = minDistance - distance
      accumulatePositionCorrection(
        world,
        frame,
        firstId,
        secondId,
        direction,
        overlap,
        correctionX,
        correctionY,
        turnLocked,
      )
      accumulateVelocityCorrection(
        world,
        firstId,
        secondId,
        direction,
        velocityX,
        velocityY,
        velocityDeltaX,
        velocityDeltaY,
        turnLocked,
      )
    }
    for (const entityId of frame.entityIds) {
      const rawX = correctionX[entityId] ?? 0
      const rawY = correctionY[entityId] ?? 0
      const magnitude = Math.hypot(rawX, rawY)
      const scale = magnitude > MAX_CORRECTION ? MAX_CORRECTION / magnitude : 1
      const moveX = rawX * scale
      const moveY = rawY * scale
      if (Math.hypot(moveX, moveY) > 0.1) corrected.add(entityId)
      x[entityId] = clamp(x[entityId] + moveX, 0, FIELD_WIDTH)
      y[entityId] = clamp(y[entityId] + moveY, 0, FIELD_HEIGHT)
      velocityX[entityId] += velocityDeltaX[entityId] ?? 0
      velocityY[entityId] += velocityDeltaY[entityId] ?? 0
    }
  }
  return {
    x,
    y,
    velocityX,
    velocityY,
    corrected,
    candidatePairCount: pairs.length,
    overlapPairCount,
  }
}

function accumulatePositionCorrection(
  world: CombatWorld,
  frame: MovementFrame,
  firstId: EntityId,
  secondId: EntityId,
  direction: { x: number; y: number },
  overlap: number,
  correctionX: number[],
  correctionY: number[],
  turnLocked: ReadonlySet<EntityId>,
): void {
  const firstCanMove = canDepenetrate(world, firstId, turnLocked)
  const secondCanMove = canDepenetrate(world, secondId, turnLocked)
  if (!firstCanMove && !secondCanMove) return
  const first = frame.transforms[firstId]!
  const second = frame.transforms[secondId]!
  const firstMass = getSizeMass(first.size)
  const secondMass = getSizeMass(second.size)
  const firstShare = !firstCanMove ? 0 : secondCanMove ? secondMass / (firstMass + secondMass) : 1
  const secondShare = !secondCanMove ? 0 : firstCanMove ? firstMass / (firstMass + secondMass) : 1
  const firstTeam = world.stores.identity.get(firstId)!.team
  const secondTeam = world.stores.identity.get(secondId)!.team
  const strength = firstTeam === secondTeam ? SAME_TEAM_CORRECTION : ENEMY_CORRECTION
  const correction = Math.min(overlap * strength, MAX_CORRECTION)
  addVector(correctionX, correctionY, firstId, -direction.x * correction * firstShare, -direction.y * correction * firstShare)
  addVector(correctionX, correctionY, secondId, direction.x * correction * secondShare, direction.y * correction * secondShare)
}

function accumulateVelocityCorrection(
  world: CombatWorld,
  firstId: EntityId,
  secondId: EntityId,
  direction: { x: number; y: number },
  velocityX: readonly number[],
  velocityY: readonly number[],
  deltaX: number[],
  deltaY: number[],
  turnLocked: ReadonlySet<EntityId>,
): void {
  dampVelocity(world, firstId, direction.x, direction.y, velocityX, velocityY, deltaX, deltaY, turnLocked)
  dampVelocity(world, secondId, -direction.x, -direction.y, velocityX, velocityY, deltaX, deltaY, turnLocked)
}

function dampVelocity(
  world: CombatWorld,
  entityId: EntityId,
  inwardX: number,
  inwardY: number,
  velocityX: readonly number[],
  velocityY: readonly number[],
  deltaX: number[],
  deltaY: number[],
  turnLocked: ReadonlySet<EntityId>,
): void {
  const combat = world.stores.combat.get(entityId)!
  const identity = world.stores.identity.get(entityId)!
  if (!canDepenetrate(world, entityId, turnLocked) || (combat.range <= 60 && !identity.type.startsWith('alien_'))) return
  const inwardSpeed = velocityX[entityId] * inwardX + velocityY[entityId] * inwardY
  if (inwardSpeed <= 0) return
  addVector(
    deltaX,
    deltaY,
    entityId,
    -inwardX * inwardSpeed * VELOCITY_DAMPING,
    -inwardY * inwardSpeed * VELOCITY_DAMPING,
  )
}

function canDepenetrate(world: CombatWorld, entityId: EntityId, turnLocked: ReadonlySet<EntityId>): boolean {
  if (turnLocked.has(entityId)) return false
  const combat = world.stores.combat.get(entityId)!
  const movement = world.stores.movement.get(entityId)!
  return combat.speed > 0 && movement.stanceMode !== 'deployed' && movement.isBurrowed !== true
}

function addVector(
  x: number[],
  y: number[],
  entityId: EntityId,
  addX: number,
  addY: number,
): void {
  x[entityId] = (x[entityId] ?? 0) + addX
  y[entityId] = (y[entityId] ?? 0) + addY
}

function getPairVector(
  world: CombatWorld,
  firstId: EntityId,
  secondId: EntityId,
): { x: number; y: number } {
  const first = world.stores.entityMeta.get(firstId)!.externalId
  const second = world.stores.entityMeta.get(secondId)!.externalId
  let hash = 2166136261
  const value = first < second ? `${first}:${second}` : `${second}:${first}`
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const angle = ((hash >>> 0) / 4294967295) * Math.PI * 2 +
    (first < second ? 0 : Math.PI)
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
