import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { UnitTypeKey } from '../../combat.types'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

const MIN_INTERCEPTABLE_RANGE = 80
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
  const targetTeam = world.stores.identity.require(targetId).team
  const interceptorId = world.resources.require('entitySpatial')
    .query(world, target.x, target.y, MAX_INTERCEPT_QUERY_RADIUS)
    .filter(entityId => isEligible(world, entityId, targetId, targetTeam, rawDamage))
    .sort((left, right) => {
      const leftTransform = world.stores.transform.require(left)
      const rightTransform = world.stores.transform.require(right)
      const distance = getDistance(leftTransform.x, leftTransform.y, target.x, target.y) -
        getDistance(rightTransform.x, rightTransform.y, target.x, target.y)
      return distance || world.stores.identity.require(left).id.localeCompare(world.stores.identity.require(right).id)
    })[0]
  if (interceptorId === undefined) return false
  const defense = world.stores.defense.require(interceptorId)
  defense.projectileInterceptCooldown = defense.projectileInterceptCooldownMax ?? 0
  const attacker = world.stores.transform.require(attackerId)
  actions.push({
    unitId: world.stores.identity.require(interceptorId).id,
    type: 'projectile_intercept',
    targetId: world.stores.identity.require(targetId).id,
    damage: rawDamage,
    fromX: attacker.x, fromY: attacker.y, toX: target.x, toY: target.y,
  })
  return true
}

function isInterceptable(world: CombatWorld, attackerId: EntityId): boolean {
  const identity = world.stores.identity.require(attackerId)
  const combat = world.stores.combat.require(attackerId)
  const stats = UNIT_TYPES[identity.type as UnitTypeKey]?.baseStats
  return Boolean(stats?.barrageAttack) ||
    Boolean(stats?.combatTags?.includes('explosive') && combat.range > MIN_INTERCEPTABLE_RANGE && combat.attack > 0)
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
