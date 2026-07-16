import type { BattleAction } from '../../combat.actions'
import { FIELD_HEIGHT, FIELD_WIDTH, getSizeMass, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

const MAX_PAIR_DISTANCE = (getSizeRadius('XL') + getSizeRadius('XL')) * 0.95
const NEIGHBOR_OFFSETS = [-1, 0, 1] as const
const SAME_TEAM_CORRECTION = 0.64
const ENEMY_CORRECTION = 0.28
const MAX_CORRECTION = 4.8
const MIN_EMIT_DISTANCE = 0.1
const VELOCITY_DAMPING = 0.85

export function runDepenetrationSystem(world: CombatWorld, actions: BattleAction[]): void {
  const pairs = getCollisionPairs(world)
  const corrections = new Map<EntityId, { x: number; y: number }>()
  for (const [firstId, secondId] of pairs) {
    const first = world.stores.transform.require(firstId)
    const second = world.stores.transform.require(secondId)
    if (first.isFlying !== second.isFlying) continue
    const minDistance = (getSizeRadius(first.size) + getSizeRadius(second.size)) * 0.95
    const dx = second.x - first.x
    const dy = second.y - first.y
    const distance = Math.hypot(dx, dy)
    const overlap = Math.max(0, minDistance - distance)
    if (overlap <= 0) continue
    const direction = distance > 0
      ? { x: dx / distance, y: dy / distance }
      : getPairVector(world, firstId, secondId)
    const firstTeam = world.stores.identity.require(firstId).team
    const secondTeam = world.stores.identity.require(secondId).team
    const correction = Math.min(overlap * (firstTeam === secondTeam ? SAME_TEAM_CORRECTION : ENEMY_CORRECTION), MAX_CORRECTION)
    applyPairCorrection(world, firstId, secondId, direction, correction, corrections)
    dampPairVelocity(world, firstId, secondId, direction)
  }
  for (const [entityId, correction] of corrections) applyCorrection(world, entityId, correction, actions)
}

function applyPairCorrection(world: CombatWorld, firstId: EntityId, secondId: EntityId, direction: { x: number; y: number }, correction: number, corrections: Map<EntityId, { x: number; y: number }>): void {
  const firstCanMove = canDepenetrate(world, firstId)
  const secondCanMove = canDepenetrate(world, secondId)
  if (!firstCanMove && !secondCanMove) return
  const firstMass = getSizeMass(world.stores.transform.require(firstId).size)
  const secondMass = getSizeMass(world.stores.transform.require(secondId).size)
  const firstShare = !firstCanMove ? 0 : secondCanMove ? secondMass / (firstMass + secondMass) : 1
  const secondShare = !secondCanMove ? 0 : firstCanMove ? firstMass / (firstMass + secondMass) : 1
  addCorrection(corrections, firstId, -direction.x * correction * firstShare, -direction.y * correction * firstShare)
  addCorrection(corrections, secondId, direction.x * correction * secondShare, direction.y * correction * secondShare)
}

function dampPairVelocity(world: CombatWorld, firstId: EntityId, secondId: EntityId, direction: { x: number; y: number }): void {
  if (canDampVelocity(world, firstId)) dampVelocity(world, firstId, direction.x, direction.y)
  if (canDampVelocity(world, secondId)) dampVelocity(world, secondId, -direction.x, -direction.y)
}

function dampVelocity(world: CombatWorld, entityId: EntityId, inwardX: number, inwardY: number): void {
  const velocity = world.stores.transform.require(entityId).velocity
  const inwardSpeed = velocity.x * inwardX + velocity.y * inwardY
  if (inwardSpeed <= 0) return
  velocity.x -= inwardX * inwardSpeed * VELOCITY_DAMPING
  velocity.y -= inwardY * inwardSpeed * VELOCITY_DAMPING
}

function canDampVelocity(world: CombatWorld, entityId: EntityId): boolean {
  const combat = world.stores.combat.require(entityId)
  const type = world.stores.identity.require(entityId).type
  return canDepenetrate(world, entityId) && (combat.range > 60 || type.startsWith('alien_'))
}

function canDepenetrate(world: CombatWorld, entityId: EntityId): boolean {
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  return combat.speed > 0 && movement.stanceMode !== 'deployed' && movement.isBurrowed !== true
}

function addCorrection(corrections: Map<EntityId, { x: number; y: number }>, entityId: EntityId, x: number, y: number): void {
  const current = corrections.get(entityId) ?? { x: 0, y: 0 }
  corrections.set(entityId, clampVector({ x: current.x + x, y: current.y + y }, MAX_CORRECTION))
}

function applyCorrection(world: CombatWorld, entityId: EntityId, correction: { x: number; y: number }, actions: BattleAction[]): void {
  if (Math.hypot(correction.x, correction.y) <= MIN_EMIT_DISTANCE) return
  const transform = world.stores.transform.require(entityId)
  const fromX = transform.x
  const fromY = transform.y
  transform.x = clamp(transform.x + correction.x, 0, FIELD_WIDTH)
  transform.y = clamp(transform.y + correction.y, 0, FIELD_HEIGHT)
  if (Math.hypot(transform.x - fromX, transform.y - fromY) <= MIN_EMIT_DISTANCE) return
  actions.push({
    unitId: world.stores.entityMeta.require(entityId).externalId,
    type: 'move', fromX: round(fromX), fromY: round(fromY),
    toX: round(transform.x), toY: round(transform.y),
    facingAngle: round(transform.currentAngle), isWalking: false,
    motionKind: 'depenetration',
  })
}

function getCollisionPairs(world: CombatWorld): [EntityId, EntityId][] {
  const entities = world.query(['identity', 'transform', 'vitality', 'combat', 'movement'])
  const buckets = new Map<string, EntityId[]>()
  for (const entityId of entities) {
    const transform = world.stores.transform.require(entityId)
    const key = getBucketKey(transform.x, transform.y)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(entityId)
    else buckets.set(key, [entityId])
  }
  const pairs: [EntityId, EntityId][] = []
  for (const bucket of buckets.values()) {
    for (const firstId of bucket) {
      for (const secondId of getNearby(world, firstId, buckets)) {
        if (secondId > firstId) pairs.push([firstId, secondId])
      }
    }
  }
  return pairs.sort((left, right) => left[0] - right[0] || left[1] - right[1])
}

function getNearby(world: CombatWorld, entityId: EntityId, buckets: Map<string, EntityId[]>): EntityId[] {
  const transform = world.stores.transform.require(entityId)
  const cellX = getCellCoordinate(transform.x)
  const cellY = getCellCoordinate(transform.y)
  const entities: EntityId[] = []
  for (const offsetY of NEIGHBOR_OFFSETS) {
    for (const offsetX of NEIGHBOR_OFFSETS) entities.push(...(buckets.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []))
  }
  return entities
}

function getPairVector(world: CombatWorld, firstId: EntityId, secondId: EntityId): { x: number; y: number } {
  const first = world.stores.entityMeta.require(firstId).externalId
  const second = world.stores.entityMeta.require(secondId).externalId
  let hash = 2166136261
  const value = first < second ? `${first}:${second}` : `${second}:${first}`
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const angle = ((hash >>> 0) / 4294967295) * Math.PI * 2 + (first < second ? 0 : Math.PI)
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

function getBucketKey(x: number, y: number): string { return `${getCellCoordinate(x)}:${getCellCoordinate(y)}` }
function getCellCoordinate(value: number): number { return Math.floor(value / MAX_PAIR_DISTANCE) }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)) }
function round(value: number): number { return Math.round(value * 100) / 100 }
function clampVector(vector: { x: number; y: number }, max: number): { x: number; y: number } {
  const mag = Math.hypot(vector.x, vector.y)
  return mag <= max ? vector : { x: (vector.x / mag) * max, y: (vector.y / mag) * max }
}
