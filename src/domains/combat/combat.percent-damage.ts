import { UNIT_TYPES } from './combat.config'
import type { SimUnit } from './combat.sim.types'

/**
 * Calculates capped percent-HP bonus damage for anti-giant weapons.
 *
 * @param attacker - Unit dealing damage.
 * @param target - Unit receiving damage.
 * @returns Capped bonus damage added before target mitigation.
 */
export function getPercentHpDamage(attacker: SimUnit, target: SimUnit): number {
  if (!hasUnitConfig(attacker.type)) return 0

  const config = UNIT_TYPES[attacker.type].baseStats.percentHpDamage
  if (!config) return 0

  return Math.min(config.maxBonus, Math.max(0, Math.floor(target.maxHp * config.percent)))
}

function hasUnitConfig(unitType: string): unitType is keyof typeof UNIT_TYPES {
  return unitType in UNIT_TYPES
}
