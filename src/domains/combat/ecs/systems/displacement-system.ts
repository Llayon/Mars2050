import type { BattleAction } from '../../combat.actions'
import { FIELD_HEIGHT, FIELD_WIDTH, getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function canUseEcsDisplacement(world: CombatWorld, attackerId: EntityId): boolean {
  const weapon = world.stores.weapon.require(attackerId)
  if (!weapon.pullOnHit && !weapon.knockbackOnHit) return true
  return world.resources.get('entitySpatial') !== undefined
}

export function applyEcsDisplacement(
  world: CombatWorld,
  attackerId: EntityId,
  centerId: EntityId,
  actions: BattleAction[],
): void {
  applyPull(world, attackerId, centerId, actions)
  applyKnockback(world, attackerId, centerId, actions)
}

function applyPull(
  world: CombatWorld,
  attackerId: EntityId,
  centerId: EntityId,
  actions: BattleAction[],
): void {
  const config = world.stores.weapon.require(attackerId).pullOnHit
  if (!config) return
  const center = world.stores.transform.require(centerId)
  for (const targetId of getTargets(world, attackerId, centerId, config.radius, config.maxTargets, false)) {
    const target = world.stores.transform.require(targetId)
    const distance = getDistance(center.x, center.y, target.x, target.y)
    const stopDistance = getSizeRadius(target.size) + getSizeRadius(center.size) + 2
    const step = Math.min(config.strength, Math.max(0, distance - stopDistance))
    if (step <= 0) continue
    const fromX = target.x
    const fromY = target.y
    target.x = clamp(target.x + ((center.x - target.x) / distance) * step, 0, FIELD_WIDTH)
    target.y = clamp(target.y + ((center.y - target.y) / distance) * step, 0, FIELD_HEIGHT)
    target.velocity = { x: 0, y: 0 }
    actions.push({
      unitId: world.stores.identity.require(targetId).id,
      type: 'move',
      fromX,
      fromY,
      toX: target.x,
      toY: target.y,
      facingAngle: target.currentAngle,
    })
    syncTransform(world, targetId)
  }
}

function applyKnockback(
  world: CombatWorld,
  attackerId: EntityId,
  centerId: EntityId,
  actions: BattleAction[],
): void {
  const config = world.stores.weapon.require(attackerId).knockbackOnHit
  if (!config || config.strength <= 0) return
  const source = world.stores.transform.require(attackerId)
  for (const targetId of getTargets(world, attackerId, centerId, config.radius, config.maxTargets, true)) {
    const target = world.stores.transform.require(targetId)
    let dx = target.x - source.x
    let dy = target.y - source.y
    let distance = Math.hypot(dx, dy)
    if (distance <= 0) {
      dx = Math.cos(source.currentAngle)
      dy = Math.sin(source.currentAngle)
      distance = 1
    }
    const fromX = target.x
    const fromY = target.y
    const toX = clamp(target.x + (dx / distance) * config.strength, 0, FIELD_WIDTH)
    const toY = clamp(target.y + (dy / distance) * config.strength, 0, FIELD_HEIGHT)
    if (toX === fromX && toY === fromY) continue
    target.x = toX
    target.y = toY
    target.velocity = { x: 0, y: 0 }
    actions.push({
      unitId: world.stores.identity.require(targetId).id,
      type: 'knockback',
      fromX,
      fromY,
      toX,
      toY,
      facingAngle: target.currentAngle,
    })
    syncTransform(world, targetId)
  }
}

function getTargets(
  world: CombatWorld,
  attackerId: EntityId,
  centerId: EntityId,
  radius: number,
  maxTargets: number | undefined,
  includeCenter: boolean,
): EntityId[] {
  const center = world.stores.transform.require(centerId)
  const attacker = world.stores.identity.require(attackerId)
  return world.resources.require('entitySpatial')
    .query(world, center.x, center.y, radius)
    .filter(targetId => {
      const target = world.stores.transform.require(targetId)
      if (!includeCenter && targetId === centerId) return false
      return !target.isFlying &&
        !world.stores.vitality.require(targetId).isDead &&
        world.stores.identity.require(targetId).team !== attacker.team
    })
    .map(targetId => ({
      targetId,
      distance: getDistance(center.x, center.y,
        world.stores.transform.require(targetId).x, world.stores.transform.require(targetId).y),
    }))
    .filter(hit => includeCenter || hit.distance > 0)
    .sort((left, right) => left.distance - right.distance || compareIds(world, left.targetId, right.targetId))
    .slice(0, maxTargets ?? Number.MAX_SAFE_INTEGER)
    .map(hit => hit.targetId)
}

function syncTransform(world: CombatWorld, targetId: EntityId): void {
  world.resources.require('entitySpatial').update(world, targetId)
}

function compareIds(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  return world.stores.identity.require(leftId).id.localeCompare(world.stores.identity.require(rightId).id)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
