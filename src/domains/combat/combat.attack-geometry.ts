import { UNIT_TYPES } from './combat.config'
import type { SimUnit } from './combat.sim.types'
import type { UnitTypeKey } from './combat.types'
import { getDistance, getSizeRadius } from './combat.utils'

/**
 * Finds deterministic secondary targets for line-piercing attacks.
 * @param attacker Unit firing the attack
 * @param primary Primary target already hit by the attack
 * @param units All simulation units
 * @returns secondary targets sorted by line progress, then id
 */
export function getLinePierceTargets(attacker: SimUnit, primary: SimUnit, units: SimUnit[]): SimUnit[] {
  const config = UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.linePierce
  if (!config) return []

  const dx = primary.x - attacker.x
  const dy = primary.y - attacker.y
  const length = Math.hypot(dx, dy)
  if (length <= 0) return []

  const ux = dx / length
  const uy = dy / length
  const candidates = units
    .filter(unit => isLinePierceCandidate(attacker, primary, unit))
    .map(unit => ({ unit, progress: getLineProgress(attacker, unit, ux, uy) }))
    .filter(hit => hit.progress > 0 && hit.progress <= length)
    .filter(hit => getLineDistance(attacker, hit.unit, ux, uy, hit.progress) <= config.width + getSizeRadius(hit.unit.size))
    .sort((a, b) => a.progress - b.progress || a.unit.id.localeCompare(b.unit.id))

  return candidates.slice(0, config.maxTargets ?? candidates.length).map(hit => hit.unit)
}

/**
 * Reads line-pierce damage multiplier for a unit.
 * @param attacker Unit firing the attack
 * @returns multiplier, or undefined when the unit has no line-pierce config
 */
export function getLinePierceDamageMultiplier(attacker: SimUnit): number | undefined {
  return UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.linePierce?.damageMultiplier
}

function isLinePierceCandidate(attacker: SimUnit, primary: SimUnit, candidate: SimUnit): boolean {
  return !candidate.isDead &&
    candidate.id !== primary.id &&
    candidate.team !== attacker.team &&
    (!candidate.isFlying || attacker.canTargetAir)
}

function getLineProgress(attacker: SimUnit, target: SimUnit, ux: number, uy: number): number {
  return (target.x - attacker.x) * ux + (target.y - attacker.y) * uy
}

function getLineDistance(attacker: SimUnit, target: SimUnit, ux: number, uy: number, progress: number): number {
  const closestX = attacker.x + ux * progress
  const closestY = attacker.y + uy * progress
  return getDistance(target.x, target.y, closestX, closestY)
}
