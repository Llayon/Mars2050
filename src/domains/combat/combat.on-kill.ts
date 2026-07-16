import type { BattleAction } from './combat.actions'
import { UNIT_TYPES } from './combat.config'
import { applyStatus } from './combat.status'
import type { SimUnit } from './combat.sim.types'
import { applyHealing } from './combat.healing'

/**
 * Applies deterministic effects when a unit confirms a kill.
 *
 * @param killer - Unit that caused the death.
 * @param victim - Unit that died.
 * @param actions - Replay action buffer.
 */
export function applyOnKillEffects(killer: SimUnit, victim: SimUnit, actions: BattleAction[]): void {
  if (!hasUnitConfig(killer.type)) return

  const effect = UNIT_TYPES[killer.type].baseStats.onKill
  if (!effect) return

  actions.push({ unitId: killer.id, type: 'on_kill', targetId: victim.id })

  if (effect.cooldownReset) {
    killer.actionCooldown = 0
  }

  if (effect.healPercent) {
    const healAmount = Math.max(1, Math.floor(killer.maxHp * effect.healPercent))
    applyHealing(killer.id, killer, healAmount, actions)
  }

  if (effect.status) {
    applyStatus(killer, { ...effect.status, sourceUnitId: killer.id }, actions)
  }
}

function hasUnitConfig(unitType: string): unitType is keyof typeof UNIT_TYPES {
  return unitType in UNIT_TYPES
}
