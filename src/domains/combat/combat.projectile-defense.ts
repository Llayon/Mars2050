import type { BattleAction } from './combat.actions'
import { UNIT_TYPES } from './combat.config'
import type { SimUnit } from './combat.sim.types'
import type { UnitTypeKey } from './combat.types'
import { getDistance } from './combat.utils'
import type { SpatialHash } from './spatial-hash'

const MIN_INTERCEPTABLE_RANGE = 80
const MAX_INTERCEPT_QUERY_RADIUS = 400

/**
 * Checks whether an attack should be eligible for projectile interception.
 *
 * @param attacker - Unit making the attack.
 * @returns True when the attack is a long-range projectile or barrage.
 */
export function isProjectileInterceptableAttack(attacker: SimUnit): boolean {
  const config = UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats
  if (!config) return false

  return Boolean(config.barrageAttack)
    || ((config.combatTags ?? []).includes('explosive') && attacker.range > MIN_INTERCEPTABLE_RANGE && attacker.attack > 0)
}

/**
 * Attempts to intercept a projectile before it reaches the protected target.
 *
 * @param attacker - Unit that fired the projectile.
 * @param target - Unit that would receive damage.
 * @param rawDamage - Incoming damage before mitigation.
 * @param units - All simulation units.
 * @param actions - Replay action sink.
 * @returns True when a projectile defense unit blocked the hit.
 */
export function tryInterceptProjectile(
  attacker: SimUnit,
  target: SimUnit,
  rawDamage: number,
  units: SimUnit[],
  actions?: BattleAction[],
  spatialHash?: SpatialHash,
): boolean {
  const candidates = spatialHash?.query(target.x, target.y, MAX_INTERCEPT_QUERY_RADIUS) ?? units
  const interceptor = getProjectileInterceptor(target, rawDamage, candidates)
  if (!interceptor) return false

  interceptor.projectileInterceptCooldown = interceptor.projectileInterceptCooldownMax ?? 0
  actions?.push({
    unitId: interceptor.id,
    type: 'projectile_intercept',
    targetId: target.id,
    damage: rawDamage,
    fromX: attacker.x,
    fromY: attacker.y,
    toX: target.x,
    toY: target.y
  })
  return true
}

function getProjectileInterceptor(target: SimUnit, rawDamage: number, units: SimUnit[]): SimUnit | null {
  return units
    .filter(unit => isEligibleInterceptor(unit, target, rawDamage))
    .map(unit => ({ unit, distance: getDistance(unit.x, unit.y, target.x, target.y) }))
    .sort((a, b) => a.distance - b.distance || a.unit.id.localeCompare(b.unit.id))[0]?.unit ?? null
}

function isEligibleInterceptor(unit: SimUnit, target: SimUnit, rawDamage: number): boolean {
  if (unit.isDead || unit.team !== target.team) return false
  if (!unit.projectileInterceptRadius || (unit.projectileInterceptCooldown ?? 0) > 0) return false
  if (unit.projectileInterceptMaxDamage !== undefined && rawDamage > unit.projectileInterceptMaxDamage) return false
  return getDistance(unit.x, unit.y, target.x, target.y) <= unit.projectileInterceptRadius
}
