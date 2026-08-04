import type { ConditionalRangeConfig, RuntimeStatusEffect } from '../combat.sim.types'
import { getSizeRadius } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { getEcsCombatTags } from './targeting-evaluation'

const GRID_TO_PIXELS = 40
const MELEE_RANGE = 60
const MELEE_ARC_QUANTA = 24
const MELEE_SLOT_TOLERANCE = 12
const RANGED_APPROACH_RANGE_RATIO = 0.72

export interface EcsPositioningDecision {
  point: { x: number; y: number }
  shouldMove: boolean
  combatInRange: boolean
}

export function getEcsPositioningDecision(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  distEdge: number,
  targetRadius: number,
  myRadius: number,
): EcsPositioningDecision {
  const transform = world.stores.transform.require(entityId)
  const targetTransform = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const targetVitality = world.stores.vitality.require(targetId)
  const targetPoint = { x: targetTransform.x, y: targetTransform.y }
  if (combat.speed <= 0 || weapon.attackType === 'spawn') return { point: targetPoint, shouldMove: false, combatInRange: true }

  const effectiveRange = getEcsEffectiveActionRangeAgainst(world, entityId, targetId)
  const minimumRange = getMinimumRange(world, entityId)
  const combatInRange = weapon.attackType === 'heal'
    ? targetVitality.hp < targetVitality.maxHp && distEdge <= effectiveRange
    : (minimumRange <= 0 || distEdge >= minimumRange) && distEdge <= effectiveRange

  if (combat.range <= MELEE_RANGE && weapon.attackType !== 'heal') {
    const point = getMeleePoint(world, entityId, targetId)
    const ready = isMeleeReady(world, entityId, targetId, point)
    const waitingReady = isMeleeWaitingReady(world, entityId, targetId)
    return {
      point: ready ? targetPoint : point,
      shouldMove: ready ? distEdge > effectiveRange : !waitingReady,
      combatInRange: ready ? combatInRange : waitingReady,
    }
  }

  if (weapon.attackType === 'heal') {
    const shouldMove = distEdge > effectiveRange
    return { point: getPreferredPoint(transform, targetTransform, targetRadius, myRadius, effectiveRange, 0.65), shouldMove, combatInRange }
  }
  if (minimumRange > 0 && distEdge < minimumRange) {
    return { point: getPreferredPoint(transform, targetTransform, targetRadius, myRadius, effectiveRange, 0.75), shouldMove: true, combatInRange: false }
  }
  if (distEdge > effectiveRange) {
    return {
      point: getPreferredPoint(transform, targetTransform, targetRadius, myRadius, effectiveRange, RANGED_APPROACH_RANGE_RATIO),
      shouldMove: true,
      combatInRange: false,
    }
  }
  return { point: targetPoint, shouldMove: false, combatInRange }
}

export function getEcsEffectiveActionRange(world: CombatWorld, entityId: EntityId): number {
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const effects = world.stores.statusControl.require(entityId).statusEffects
  const stanceMultiplier = movement.stanceMode === 'deployed'
    ? getPositiveMultiplier(movement.stanceConfig?.rangeMultiplier, 1)
    : 1
  let range = combat.range * stanceMultiplier
  const boost = getStatusValue(effects, 'range_boost')
  const suppression = getStatusValue(effects, 'range_suppressed')
  if (boost !== undefined && boost > 0) range *= Math.min(3, boost >= 1 ? boost : 1 + boost)
  if (suppression === undefined || suppression <= 0) return range
  const reduction = suppression <= 1 ? suppression : suppression / 100
  return Math.max(0, range * Math.max(0.05, 1 - Math.min(0.95, reduction)))
}

export function getEcsEffectiveActionRangeAgainst(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
): number {
  let range = getEcsEffectiveActionRange(world, entityId)
  const configs = world.stores.targeting.require(entityId).conditionalRange ?? []
  for (const config of configs) {
    if (!matchesConditionalRange(world, entityId, targetId, config)) continue
    if (config.rangeMult !== undefined) range *= Math.max(0, config.rangeMult)
    if (config.rangeAdd !== undefined) range += config.rangeAdd
  }
  return Math.max(0, range)
}

export function getEcsStatusValue(effects: RuntimeStatusEffect[], type: RuntimeStatusEffect['type']): number | undefined {
  return getStatusValue(effects, type)
}

function matchesConditionalRange(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  config: ConditionalRangeConfig,
): boolean {
  const target = world.stores.transform.require(targetId)
  if (config.target === 'air') return target.isFlying
  if (config.target === 'ground') return !target.isFlying
  if (config.target === 'tag') {
    return config.tag !== undefined && getEcsCombatTags(world, targetId).includes(config.tag)
  }
  const sourceRank = world.stores.identity.require(entityId).rank ?? 1
  const targetRank = world.stores.identity.require(targetId).rank ?? 1
  const relation = sourceRank === targetRank
    ? 'same_rank'
    : targetRank > sourceRank ? 'higher_rank' : 'lower_rank'
  return config.target === relation
}

export function isEcsMeleeEngagementReady(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
): boolean {
  if (world.stores.combat.require(entityId).range > MELEE_RANGE) return true
  return isMeleeReady(world, entityId, targetId, getMeleePoint(world, entityId, targetId))
}

function getStatusValue(effects: RuntimeStatusEffect[], type: RuntimeStatusEffect['type']): number | undefined {
  let value: number | undefined
  for (const effect of effects) {
    if (effect.type !== type || effect.duration <= 0) continue
    if (value === undefined) value = effect.value
    else if (effect.value !== undefined) value = type === 'slow' && value <= 1 && effect.value <= 1
      ? Math.min(value, effect.value)
      : Math.max(value, effect.value)
  }
  return value
}

function getMinimumRange(world: CombatWorld, entityId: EntityId): number {
  return world.stores.runtimeRules.require(entityId).minimumRange
}

function getMeleePoint(world: CombatWorld, entityId: EntityId, targetId: EntityId): { x: number; y: number } {
  const transform = world.stores.transform.require(entityId)
  const target = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const refs = world.stores.entityTargets.require(entityId)
  if (refs.meleeWaitingTarget === targetId) return getWaitingPoint(world, entityId, targetId)
  const slot = world.stores.targeting.require(entityId).meleeSlotIndex
  if (refs.meleeTarget !== targetId || slot === undefined || slot < 0 || slot >= MELEE_ARC_QUANTA) return { x: target.x, y: target.y }
  const span = getMeleeSectorSpan(getSizeRadius(transform.size), getSizeRadius(target.size))
  const angle = ((slot + span / 2) / MELEE_ARC_QUANTA) * Math.PI * 2
  const radius = getSizeRadius(target.size) + getSizeRadius(transform.size) + Math.max(2, combat.range * 0.65)
  return { x: target.x + Math.cos(angle) * radius, y: target.y + Math.sin(angle) * radius }
}

function isMeleeReady(world: CombatWorld, entityId: EntityId, targetId: EntityId, point: { x: number; y: number }): boolean {
  if (world.stores.entityTargets.require(entityId).meleeTarget !== targetId) return false
  const transform = world.stores.transform.require(entityId)
  const range = world.stores.combat.require(entityId).range
  return Math.hypot(transform.x - point.x, transform.y - point.y) <= Math.max(MELEE_SLOT_TOLERANCE, range * 0.75 + getSizeRadius(transform.size) * 0.5)
}

function isMeleeWaitingReady(world: CombatWorld, entityId: EntityId, targetId: EntityId): boolean {
  if (world.stores.entityTargets.require(entityId).meleeWaitingTarget !== targetId) return false
  const transform = world.stores.transform.require(entityId)
  const point = getWaitingPoint(world, entityId, targetId)
  return Math.hypot(transform.x - point.x, transform.y - point.y) <= MELEE_SLOT_TOLERANCE
}

function getWaitingPoint(world: CombatWorld, entityId: EntityId, targetId: EntityId): { x: number; y: number } {
  const identity = world.stores.identity.require(entityId)
  const targetIdentity = world.stores.identity.require(targetId)
  const transform = world.stores.transform.require(entityId)
  const target = world.stores.transform.require(targetId)
  const range = world.stores.combat.require(entityId).range
  const radius = getSizeRadius(target.size) + getSizeRadius(transform.size) + Math.max(36, range * 1.35)
  let hash = 2166136261
  for (const char of `${identity.id}:${targetIdentity.id}:wait`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const angle = ((hash >>> 0) / 4294967295) * Math.PI * 2
  return { x: target.x + Math.cos(angle) * radius, y: target.y + Math.sin(angle) * radius }
}

function getMeleeSectorSpan(unitRadius: number, targetRadius: number): number {
  const raw = Math.floor((2 * Math.PI * (targetRadius + unitRadius)) / (unitRadius * 2))
  const desired = Math.max(4, Math.min(12, raw))
  const slots = Math.floor(MELEE_ARC_QUANTA / Math.ceil(MELEE_ARC_QUANTA / desired))
  return Math.max(1, Math.ceil(MELEE_ARC_QUANTA / slots))
}

function getPreferredPoint(unit: { x: number; y: number }, target: { x: number; y: number }, targetRadius: number, myRadius: number, range: number, ratio: number): { x: number; y: number } {
  const dx = unit.x - target.x
  const dy = unit.y - target.y
  const mag = Math.max(1, Math.hypot(dx, dy))
  const preferred = targetRadius + myRadius + Math.max(0, range * ratio)
  return { x: target.x + (dx / mag) * preferred, y: target.y + (dy / mag) * preferred }
}

function getPositiveMultiplier(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback
}
