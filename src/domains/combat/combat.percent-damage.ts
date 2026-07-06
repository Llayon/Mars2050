import { UNIT_TYPES } from './combat.config'
import type { PercentHpDamageConfig, SimUnit } from './combat.sim.types'

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
  return getConfiguredPercentHpDamage(target, config)
}

export function getConfiguredPercentHpDamage(target: SimUnit, config: PercentHpDamageConfig | undefined): number {
  if (!config) return 0

  const basisValue = (config.basis ?? 'max') === 'current' ? target.hp : target.maxHp
  let damage = Math.max(0, Math.floor(basisValue * config.percent))
  if (config.minBonus !== undefined) damage = Math.max(damage, Math.floor(config.minBonus))
  if (config.maxBonus !== undefined) damage = Math.min(damage, Math.floor(config.maxBonus))
  return Math.max(0, damage)
}

function hasUnitConfig(unitType: string): unitType is keyof typeof UNIT_TYPES {
  return unitType in UNIT_TYPES
}
