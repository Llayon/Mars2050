import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'

/**
 * Toggles deterministic burrow state for movement-based underground units.
 * @param unit Unit to update
 * @param shouldBurrow Whether current movement intent should burrow the unit
 * @param actions Replay action sink
 * @returns true when burrow state changed
 */
export function syncBurrowState(unit: SimUnit, shouldBurrow: boolean, actions: BattleAction[]): boolean {
  const next = Boolean(unit.burrowConfig && shouldBurrow && !unit.isFlying && !unit.isDead && !isBurrowRevealed(unit))
  if ((unit.isBurrowed === true) === next) return false

  unit.isBurrowed = next
  actions.push({ unitId: unit.id, type: 'burrow_change', value: next ? 1 : 0 })
  return true
}

/**
 * Forces an underground unit to surface when detection reveals it.
 * @param unit Unit receiving reveal
 * @param actions Optional replay action sink
 * @returns true when burrow state changed
 */
export function breakBurrowOnReveal(unit: SimUnit, actions?: BattleAction[]): boolean {
  if (!unit.isBurrowed) return false

  unit.isBurrowed = false
  actions?.push({ unitId: unit.id, type: 'burrow_change', value: 0 })
  return true
}

/**
 * Reads the strongest active movement-defense reduction.
 * @param unit Unit receiving damage
 * @returns damage reduction ratio from movement or burrow state
 */
export function getMovementDefenseReduction(unit: SimUnit): number {
  const movingReduction = unit.isMoving ? unit.damageReductionWhileMoving ?? 0 : 0
  const burrowReduction = unit.isBurrowed && !isBurrowRevealed(unit) ? unit.burrowConfig?.damageReduction ?? 0 : 0
  return clampReduction(Math.max(movingReduction, burrowReduction))
}

function isBurrowRevealed(unit: SimUnit): boolean {
  return unit.statusEffects.some(effect => effect.type === 'revealed' && effect.duration > 0)
}

function clampReduction(value: number): number {
  return Math.max(0, Math.min(0.9, value))
}
