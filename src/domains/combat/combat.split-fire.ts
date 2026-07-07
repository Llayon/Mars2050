import { UNIT_TYPES } from './combat.config'
import type { SimUnit } from './combat.sim.types'
import type { UnitTypeKey } from './combat.types'
import { canWeaponTargetUnit } from './combat.targeting-rules'
import { getDistance, getSizeRadius } from './combat.utils'

const GRID_TO_PIXELS = 40

/**
 * Selects deterministic secondary targets for split-fire weapons.
 * @param attacker Unit firing the split weapon
 * @param primary Primary target already hit by the attack
 * @param units All simulation units
 * @returns secondary targets sorted by distance, then id
 */
export function getSplitFireTargets(attacker: SimUnit, primary: SimUnit, units: SimUnit[]): SimUnit[] {
  const config = attacker.splitFire ?? UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.splitFire
  if (!config) return []

  const range = (config.range ?? attacker.range / GRID_TO_PIXELS) * GRID_TO_PIXELS
  return units
    .filter(unit => !unit.isDead && unit.id !== primary.id && unit.team !== attacker.team)
    .filter(unit => canWeaponTargetUnit(attacker, unit, config))
    .map(unit => ({ unit, distance: getDistance(attacker.x, attacker.y, unit.x, unit.y) }))
    .filter(hit => hit.distance <= range + getSizeRadius(hit.unit.size))
    .sort((a, b) => a.distance - b.distance || a.unit.id.localeCompare(b.unit.id))
    .slice(0, config.maxTargets)
    .map(hit => hit.unit)
}

/**
 * Reads split-fire damage multiplier for a unit.
 * @param attacker Unit firing the split weapon
 * @returns multiplier, or undefined when the unit has no split-fire config
 */
export function getSplitFireDamageMultiplier(attacker: SimUnit): number | undefined {
  return attacker.splitFire?.damageMultiplier ?? UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.splitFire?.damageMultiplier
}
