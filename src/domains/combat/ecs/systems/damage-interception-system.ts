import type { BattleAction } from '../../combat.actions'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

const MAX_INTERCEPT_QUERY_RADIUS = 400

export function tryEcsProjectileInterception(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  rawDamage: number,
  actions: BattleAction[],
): boolean {
  if (!isInterceptable(world, attackerId)) return false
  const target = world.stores.transform.require(targetId)
  return tryEcsPointInterception(world, attackerId, targetId, target.x, target.y, rawDamage, actions)
}

export function tryEcsPointInterception(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId | undefined,
  x: number,
  y: number,
  rawDamage: number,
  actions: BattleAction[],
  force = false,
): boolean {
  if (!isInterceptable(world, attackerId)) return false
  const targetTeam = targetId ? world.stores.identity.require(targetId).team : world.stores.identity.require(attackerId).team === 'attacker' ? 'defender' : 'attacker'
  const interceptorId = world.resources.require('entitySpatial')
    .query(world, x, y, MAX_INTERCEPT_QUERY_RADIUS)
    .filter(entityId => isEligibleAtPoint(world, entityId, targetTeam, rawDamage, x, y))
    .sort((left, right) => {
      const leftTransform = world.stores.transform.require(left)
      const rightTransform = world.stores.transform.require(right)
      const distance = getDistance(leftTransform.x, leftTransform.y, x, y) -
        getDistance(rightTransform.x, rightTransform.y, x, y)
      return distance || world.stores.identity.require(left).id.localeCompare(world.stores.identity.require(right).id)
    })[0]
  if (interceptorId === undefined) return false
  const defense = world.stores.defense.require(interceptorId)
  defense.projectileInterceptCooldown = defense.projectileInterceptCooldownMax ?? 0
  const attacker = world.stores.transform.require(attackerId)
  actions.push({
    unitId: world.stores.identity.require(interceptorId).id,
    type: 'projectile_intercept',
    ...(targetId ? { targetId: world.stores.identity.require(targetId).id } : {}),
    damage: rawDamage,
    fromX: attacker.x, fromY: attacker.y, toX: x, toY: y,
  })
  return true
}

function isInterceptable(world: CombatWorld, attackerId: EntityId): boolean {
  return world.stores.runtimeRules.require(attackerId).projectileInterceptable
}

function isEligible(world: CombatWorld, entityId: EntityId, targetId: EntityId, team: string, rawDamage: number): boolean {
  const vitality = world.stores.vitality.require(entityId)
  const identity = world.stores.identity.require(entityId)
  const defense = world.stores.defense.require(entityId)
  if (vitality.isDead || identity.team !== team || !defense.projectileInterceptRadius || (defense.projectileInterceptCooldown ?? 0) > 0) return false
  if (defense.projectileInterceptMaxDamage !== undefined && rawDamage > defense.projectileInterceptMaxDamage) return false
  const source = world.stores.transform.require(entityId)
  const target = world.stores.transform.require(targetId)
  return getDistance(source.x, source.y, target.x, target.y) <= defense.projectileInterceptRadius
}

function isEligibleAtPoint(world: CombatWorld, entityId: EntityId, team: string, rawDamage: number, x: number, y: number): boolean {
  const vitality = world.stores.vitality.require(entityId)
  const identity = world.stores.identity.require(entityId)
  const defense = world.stores.defense.require(entityId)
  if (vitality.isDead || identity.team !== team || !defense.projectileInterceptRadius || (defense.projectileInterceptCooldown ?? 0) > 0) return false
  if (defense.projectileInterceptMaxDamage !== undefined && rawDamage > defense.projectileInterceptMaxDamage) return false
  const source = world.stores.transform.require(entityId)
  return getDistance(source.x, source.y, x, y) <= defense.projectileInterceptRadius
}
