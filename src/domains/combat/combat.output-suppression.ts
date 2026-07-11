import type { SimUnit } from './combat.sim.types'

const OUTPUT_SUPPRESSION_CAP = 0.5

/**
 * Returns capped additive output suppression from active stacks.
 * @param unit Unit to inspect
 * @returns normalized suppression value from 0 to OUTPUT_SUPPRESSION_CAP
 */
export function getOutputSuppressionValue(unit: Pick<SimUnit, 'statusEffects'>): number {
  let total = 0
  for (const effect of unit.statusEffects) {
    if (effect.type !== 'output_suppressed' || effect.duration <= 0) continue
    total += normalizeSuppressionValue(effect.value)
  }
  return Math.min(OUTPUT_SUPPRESSION_CAP, total)
}

/**
 * Reduces HP damage while the attacker is output-suppressed.
 * @param attacker Unit dealing damage
 * @param damage Damage after defense and before accuracy/target modifiers
 * @returns suppressed damage value
 */
export function applyOutputSuppressionDamage(attacker: Pick<SimUnit, 'statusEffects'>, damage: number): number {
  const suppression = getOutputSuppressionValue(attacker)
  if (suppression <= 0) return damage
  return Math.max(0, Math.floor(damage * Math.max(0, 1 - suppression)))
}

/**
 * Extends next action cooldown while the acting unit is output-suppressed.
 * @param unit Unit assigning its next action cooldown
 * @param baseCooldown Cooldown after weapon and stance modifiers
 * @returns cooldown with output suppression applied
 */
export function getOutputSuppressedActionCooldown(unit: Pick<SimUnit, 'statusEffects'>, baseCooldown: number): number {
  const cooldown = Math.max(1, Math.round(baseCooldown))
  const suppression = getOutputSuppressionValue(unit)
  if (suppression <= 0) return cooldown
  return Math.max(1, Math.round(cooldown * (1 + suppression)))
}

function normalizeSuppressionValue(value: number | undefined): number {
  if (value === undefined || value <= 0) return 0
  return value <= 1 ? value : value / 100
}
