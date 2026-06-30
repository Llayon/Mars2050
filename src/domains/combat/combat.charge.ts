import type { BattleAction } from './combat.actions'
import { UNIT_TYPES } from './combat.config'
import type { SimUnit } from './combat.sim.types'

/**
 * Adds movement distance to a unit charge pool when its config supports charge damage.
 *
 * @param unit - Unit that moved this tick.
 * @param distance - Actual movement distance in pixels.
 */
export function recordChargeMovement(unit: SimUnit, distance: number): void {
  const config = getChargeConfig(unit)
  if (!config || distance <= 0) return

  unit.chargeDistance = Math.min(config.maxDistance, (unit.chargeDistance ?? 0) + distance)
}

/**
 * Converts stored movement distance into capped primary-hit damage.
 *
 * @param attacker - Unit making the primary attack.
 * @param target - Current primary target.
 * @param baseDamage - Damage before charge scaling.
 * @param actions - Replay action sink.
 * @returns Damage after deterministic charge scaling.
 */
export function getChargeDamage(attacker: SimUnit, target: SimUnit, baseDamage: number, actions: BattleAction[]): number {
  const config = getChargeConfig(attacker)
  if (!config) return baseDamage

  const chargeDistance = attacker.chargeDistance ?? 0
  attacker.chargeDistance = 0
  if (chargeDistance < config.minDistance) return baseDamage

  const chargeWindow = Math.max(1, config.maxDistance - config.minDistance)
  const ratio = Math.min(1, (chargeDistance - config.minDistance) / chargeWindow)
  const multiplier = 1 + ratio * (config.maxMultiplier - 1)
  actions.push({ unitId: attacker.id, type: 'charge_damage', targetId: target.id, value: Math.round(multiplier * 100) / 100 })
  return Math.floor(baseDamage * multiplier)
}

function getChargeConfig(unit: SimUnit): { minDistance: number; maxDistance: number; maxMultiplier: number } | undefined {
  if (!hasUnitConfig(unit.type)) return undefined
  return UNIT_TYPES[unit.type].baseStats.chargeDamage
}

function hasUnitConfig(unitType: string): unitType is keyof typeof UNIT_TYPES {
  return unitType in UNIT_TYPES
}
