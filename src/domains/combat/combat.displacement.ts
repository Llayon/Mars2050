import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'
import { FIELD_HEIGHT, FIELD_WIDTH, getDistance, getSizeRadius } from './combat.utils'

/**
 * Applies deterministic pull displacement around the primary hit target.
 * @param source Unit causing the pull
 * @param center Primary target and pull center
 * @param units All simulation units
 * @param actions Replay actions
 */
export function applyPullOnHit(source: SimUnit, center: SimUnit, units: SimUnit[], actions: BattleAction[]): void {
  const config = source.pullOnHit
  if (!config) return

  const targets = units
    .filter(unit => isDisplacementCandidate(source, unit))
    .map(unit => ({ unit, distance: getDistance(center.x, center.y, unit.x, unit.y) }))
    .filter(hit => hit.distance > 0 && hit.distance <= config.radius)
    .sort((a, b) => a.distance - b.distance || a.unit.id.localeCompare(b.unit.id))
    .slice(0, config.maxTargets ?? units.length)

  for (const hit of targets) {
    pullUnitToward(hit.unit, center, hit.distance, config.strength, actions)
  }
}

/**
 * Applies deterministic knockback displacement around the primary hit target.
 * @param source Unit causing the knockback
 * @param center Primary target and knockback center
 * @param units All simulation units
 * @param actions Replay actions
 */
export function applyKnockbackOnHit(source: SimUnit, center: SimUnit, units: SimUnit[], actions: BattleAction[]): void {
  const config = source.knockbackOnHit
  if (!config) return

  const targets = units
    .filter(unit => isDisplacementCandidate(source, unit))
    .map(unit => ({ unit, distance: getDistance(center.x, center.y, unit.x, unit.y) }))
    .filter(hit => hit.distance <= config.radius)
    .sort((a, b) => a.distance - b.distance || a.unit.id.localeCompare(b.unit.id))
    .slice(0, config.maxTargets ?? units.length)

  for (const hit of targets) {
    knockUnitAway(hit.unit, source, config.strength, actions)
  }
}

function isDisplacementCandidate(source: SimUnit, target: SimUnit): boolean {
  return !target.isDead && target.team !== source.team && !target.isFlying
}

function pullUnitToward(unit: SimUnit, center: SimUnit, distance: number, strength: number, actions: BattleAction[]): void {
  const stopDistance = getSizeRadius(unit.size) + getSizeRadius(center.size) + 2
  const step = Math.min(strength, Math.max(0, distance - stopDistance))
  if (step <= 0) return

  const fromX = unit.x
  const fromY = unit.y
  unit.x = clamp(unit.x + ((center.x - unit.x) / distance) * step, 0, FIELD_WIDTH)
  unit.y = clamp(unit.y + ((center.y - unit.y) / distance) * step, 0, FIELD_HEIGHT)
  unit.velocity = { x: 0, y: 0 }
  actions.push({ unitId: unit.id, type: 'move', fromX, fromY, toX: unit.x, toY: unit.y, facingAngle: unit.currentAngle })
}

function knockUnitAway(unit: SimUnit, source: SimUnit, strength: number, actions: BattleAction[]): void {
  if (strength <= 0) return

  let dx = unit.x - source.x
  let dy = unit.y - source.y
  let distance = Math.hypot(dx, dy)
  if (distance <= 0) {
    dx = Math.cos(source.currentAngle)
    dy = Math.sin(source.currentAngle)
    distance = 1
  }

  const fromX = unit.x
  const fromY = unit.y
  const toX = clamp(unit.x + (dx / distance) * strength, 0, FIELD_WIDTH)
  const toY = clamp(unit.y + (dy / distance) * strength, 0, FIELD_HEIGHT)
  if (toX === fromX && toY === fromY) return

  unit.x = toX
  unit.y = toY
  unit.velocity = { x: 0, y: 0 }
  actions.push({ unitId: unit.id, type: 'knockback', fromX, fromY, toX, toY, facingAngle: unit.currentAngle })
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
