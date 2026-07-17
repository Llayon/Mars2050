import type { BattleAction } from '../combat.actions'
import type { Obstacle } from '../combat.sim.types'
import { UNIT_TYPES } from '../combat.config'
import { getDistance, getSizeRadius } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { getEcsStatusValue } from './movement-positioning'

const STUCK_PROGRESS_EPSILON = 1.5
const STUCK_TICK_THRESHOLD = 8
const AVOIDANCE_TICKS = 14
const OBSTACLE_INFLUENCE_PADDING = 70

export function syncEcsMovementIntentModes(world: CombatWorld, entityId: EntityId, shouldMove: boolean, actions: BattleAction[]): void {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const vitality = world.stores.vitality.require(entityId)
  const movement = world.stores.movement.require(entityId)
  if (movement.stanceConfig && shouldMove) {
    movement.stanceTicks = 0
    if (movement.stanceMode === 'deployed') {
      movement.stanceMode = 'mobile'
      actions.push({ unitId: identity.id, type: 'stance_change', stanceMode: 'mobile' })
    }
  }
  const mode = movement.modeSwitchConfig
  if (mode?.trigger === 'while_moving' && !vitality.isDead) {
    const next = shouldMove ? 'air' : 'ground'
    if (movement.mobilityMode !== next || transform.isFlying !== (next === 'air')) {
      movement.mobilityMode = next
      transform.isFlying = next === 'air'
      actions.push({ unitId: identity.id, type: 'mode_change', modeState: next })
    }
  }
}

export function syncEcsMovementActivity(world: CombatWorld, entityId: EntityId, shouldMove: boolean, actions: BattleAction[]): void {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const vitality = world.stores.vitality.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const revealed = status.statusEffects.some(effect => effect.type === 'revealed' && effect.duration > 0)
  const burrowed = Boolean(movement.burrowConfig && shouldMove && !transform.isFlying && !vitality.isDead && !revealed)
  if ((movement.isBurrowed === true) !== burrowed) {
    if (movement.isBurrowed && !burrowed) {
      const attackMult = movement.burrowConfig?.emergeAttackMult
      const aoeRadiusAdd = movement.burrowConfig?.emergeAoeRadiusAdd
      if (attackMult || aoeRadiusAdd) {
        weapon.emergeStrikePending = { attackMult, aoeRadiusAdd }
        actions.push({ unitId: identity.id, type: 'emerge_strike', value: attackMult ?? aoeRadiusAdd })
      }
    }
    movement.isBurrowed = burrowed
    actions.push({ unitId: identity.id, type: 'burrow_change', value: burrowed ? 1 : 0 })
  }
  if (movement.stealthWhileMoving) {
    const active = shouldMove && !status.hasAttacked && !revealed
    if ((movement.movementStealthActive ?? false) !== active) {
      movement.movementStealthActive = active
      actions.push({ unitId: identity.id, type: 'stealth_change', modeState: active ? 'movement_active' : 'movement_inactive' })
    }
  }
}

export function getEcsMovementSpeed(world: CombatWorld, entityId: EntityId): number {
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const effects = world.stores.statusControl.require(entityId).statusEffects
  const slow = getEcsStatusValue(effects, 'slow')
  const haste = getEcsStatusValue(effects, 'haste')
  let statusMultiplier = 1
  if (slow !== undefined) statusMultiplier *= slow <= 1 ? Math.max(0, slow) : Math.max(0, 1 - slow)
  if (haste !== undefined) statusMultiplier *= haste >= 1 ? haste : 1 + Math.max(0, haste)
  const stance = movement.stanceMode === 'deployed' ? Math.max(0, movement.stanceConfig?.speedMultiplier ?? 1) : 1
  const mode = movement.modeSwitchConfig
  const modeMultiplier = !mode ? 1 : movement.mobilityMode === 'air'
    ? getPositiveMultiplier(mode.airSpeedMultiplier, 1)
    : getPositiveMultiplier(mode.groundSpeedMultiplier, 1)
  return combat.speed * statusMultiplier * stance * modeMultiplier
}

export function updateEcsStuckRecovery(world: CombatWorld, entityId: EntityId, targetId: EntityId, distance: number, inRange: boolean): void {
  const identity = world.stores.identity.require(entityId)
  const targetIdentity = world.stores.identity.require(targetId)
  const transform = world.stores.transform.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  if (transform.isFlying || inRange || combat.speed <= 0) {
    movement.stuckTicks = 0
    movement.avoidanceTicks = 0
    movement.lastTargetDistance = undefined
    movement.lastProgressTargetId = undefined
    return
  }
  if (movement.lastProgressTargetId !== targetIdentity.id) {
    movement.lastProgressTargetId = targetIdentity.id
    movement.lastTargetDistance = distance
    movement.stuckTicks = 0
    movement.avoidanceTicks = 0
    return
  }
  const progress = (movement.lastTargetDistance ?? distance) - distance
  movement.lastTargetDistance = distance
  movement.lastProgressX = transform.x
  movement.lastProgressY = transform.y
  if (progress > STUCK_PROGRESS_EPSILON) {
    movement.stuckTicks = 0
    if ((movement.avoidanceTicks ?? 0) > 0) movement.avoidanceTicks = Math.max(0, (movement.avoidanceTicks ?? 0) - 2)
    return
  }
  movement.stuckTicks = (movement.stuckTicks ?? 0) + 1
  if (movement.stuckTicks >= STUCK_TICK_THRESHOLD) {
    movement.avoidanceSide = movement.avoidanceSide ?? getAvoidanceSide(identity.id, targetIdentity.id)
    movement.avoidanceTicks = AVOIDANCE_TICKS
  } else if ((movement.avoidanceTicks ?? 0) > 0) movement.avoidanceTicks = Math.max(0, (movement.avoidanceTicks ?? 0) - 1)
}

export function getEcsRecoveryForce(world: CombatWorld, entityId: EntityId, targetId: EntityId, obstacles: Obstacle[]): { forceX: number; forceY: number; isRecovering: boolean } {
  const identity = world.stores.identity.require(entityId)
  const targetIdentity = world.stores.identity.require(targetId)
  const transform = world.stores.transform.require(entityId)
  const target = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  if ((movement.avoidanceTicks ?? 0) <= 0 || transform.isFlying) return { forceX: 0, forceY: 0, isRecovering: false }
  movement.avoidanceTicks = Math.max(0, (movement.avoidanceTicks ?? 0) - 1)
  const obstacle = findObstacle(transform, obstacles)
  const side = movement.avoidanceSide ?? getAvoidanceSide(identity.id, targetIdentity.id)
  if (!obstacle) {
    const dx = target.x - transform.x
    const dy = target.y - transform.y
    const mag = Math.max(1, Math.hypot(dx, dy))
    return { forceX: (-dy / mag) * side * combat.speed * 0.45, forceY: (dx / mag) * side * combat.speed * 0.45, isRecovering: true }
  }
  const dx = transform.x - obstacle.x
  const dy = transform.y - obstacle.y
  const mag = Math.max(1, Math.hypot(dx, dy))
  const influence = Math.max(0.25, 1 - getDistance(transform.x, transform.y, obstacle.x, obstacle.y) / (obstacle.radius + getSizeRadius(transform.size) + OBSTACLE_INFLUENCE_PADDING))
  return { forceX: (-dy / mag) * side * combat.speed * 0.8 * influence, forceY: (dx / mag) * side * combat.speed * 0.8 * influence, isRecovering: true }
}

export function recordEcsChargeMovement(world: CombatWorld, entityId: EntityId, distance: number): void {
  const identity = world.stores.identity.require(entityId)
  const config = UNIT_TYPES[identity.type as keyof typeof UNIT_TYPES]?.baseStats.chargeDamage
  if (!config || distance <= 0) return
  const targeting = world.stores.targeting.require(entityId)
  targeting.chargeDistance = Math.min(config.maxDistance, (targeting.chargeDistance ?? 0) + distance)
}

function findObstacle(transform: { x: number; y: number; size: 'S' | 'M' | 'L' | 'XL' }, obstacles: Obstacle[]): Obstacle | null {
  let best: Obstacle | null = null
  let bestDistance = Infinity
  for (const obstacle of obstacles) {
    const distance = getDistance(transform.x, transform.y, obstacle.x, obstacle.y)
    if (distance <= obstacle.radius + getSizeRadius(transform.size) + OBSTACLE_INFLUENCE_PADDING && distance < bestDistance) {
      best = obstacle
      bestDistance = distance
    }
  }
  return best
}

function getAvoidanceSide(unitId: string, targetId: string): -1 | 1 {
  let hash = 2166136261
  for (const char of `${unitId}:${targetId}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 2 === 0 ? -1 : 1
}

function getPositiveMultiplier(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback
}
