import type { SimUnit } from './combat.sim.types'
import { getStatusValue } from './combat.status'

/**
 * Converts accuracy penalties into deterministic glancing damage.
 * @param attacker Unit dealing damage
 * @param damage Damage after defense and output modifiers
 * @returns damage after active accuracy penalties
 */
export function applyAccuracyPenalty(attacker: SimUnit, damage: number): number {
  const penalty = getStatusValue(attacker, 'accuracy_reduced') ?? 0
  if (damage <= 0 || penalty <= 0) return damage

  const resist = Math.max(0, Math.min(1, attacker.accuracyPenaltyResist ?? 0))
  const effectivePenalty = Math.max(0, Math.min(0.95, penalty * (1 - resist)))
  return Math.max(0, Math.floor(damage * (1 - effectivePenalty)))
}
