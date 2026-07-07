import { UNIT_TYPES } from './combat.config'
import type { SimUnit } from './combat.sim.types'
import type { UnitTypeKey } from './combat.types'
import { canWeaponTargetUnit } from './combat.targeting-rules'
import { getDistance, getSizeRadius } from './combat.utils'

const GRID_TO_PIXELS = 40

export function getSideWeaponTargets(attacker: SimUnit, primary: SimUnit, units: SimUnit[]): SimUnit[] {
  const config = attacker.sideWeapon ?? UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.sideWeapon
  if (!config) return []

  const range = config.range * GRID_TO_PIXELS
  return units
    .filter(unit => !unit.isDead && unit.id !== primary.id && unit.team !== attacker.team)
    .filter(unit => canWeaponTargetUnit(attacker, unit, config))
    .map(unit => ({ unit, distance: getDistance(attacker.x, attacker.y, unit.x, unit.y) }))
    .filter(hit => hit.distance <= range + getSizeRadius(hit.unit.size))
    .sort((a, b) => a.distance - b.distance || a.unit.id.localeCompare(b.unit.id))
    .slice(0, config.maxTargets)
    .map(hit => hit.unit)
}

export function getSideWeaponDamage(attacker: SimUnit): number {
  return attacker.sideWeapon?.damage ?? UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.sideWeapon?.damage ?? 0
}
