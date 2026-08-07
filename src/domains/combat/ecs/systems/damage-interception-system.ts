import type { BattleAction } from '../../combat.actions'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { PendingImpact } from '../pending-impacts'
import { compareEntityExternalIdsForMode } from '../authored-order'

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
      return distance || compareEntityExternalIdsForMode(world, left, right)
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

export interface TemporalImpactPoint {
  impact: PendingImpact
  x: number
  y: number
}

export interface InterceptionAllocation {
  byImpact: ReadonlyMap<number, EntityId>
  cooldownEntities: readonly EntityId[]
}

export function allocateTemporalInterceptions(
  world: CombatWorld,
  points: readonly TemporalImpactPoint[],
): InterceptionAllocation {
  const byImpact = new Map<number, EntityId>()
  const used = new Set<EntityId>()
  const sorted = [...points]
    .filter(point => point.impact.interceptable)
    .sort((left, right) => right.impact.interceptionDamage - left.impact.interceptionDamage || left.impact.id - right.impact.id)
  for (const point of sorted) {
    const candidates = world.resources.require('entitySpatial')
      .query(world, point.x, point.y, MAX_INTERCEPT_QUERY_RADIUS)
      .filter(entityId => !used.has(entityId) && isEligibleAtPoint(
        world,
        entityId,
        point.impact.hostileTeamAtLaunch ?? point.impact.targetTeam ?? oppositeTeam(point.impact.sourceTeam),
        point.impact.interceptionDamage,
        point.x,
        point.y,
      ))
      .sort((left, right) => {
        const leftTransform = world.stores.transform.require(left)
        const rightTransform = world.stores.transform.require(right)
        return getDistance(leftTransform.x, leftTransform.y, point.x, point.y) -
          getDistance(rightTransform.x, rightTransform.y, point.x, point.y) ||
          compareEntityExternalIdsForMode(world, left, right)
      })
    const interceptorId = candidates[0]
    if (interceptorId === undefined) continue
    used.add(interceptorId)
    byImpact.set(point.impact.id, interceptorId)
  }
  return { byImpact, cooldownEntities: [...used] }
}

function isInterceptable(world: CombatWorld, attackerId: EntityId): boolean {
  return world.stores.runtimeRules.require(attackerId).projectileInterceptable
}

function oppositeTeam(team: 'attacker' | 'defender'): 'attacker' | 'defender' {
  return team === 'attacker' ? 'defender' : 'attacker'
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
