import type { BattleAction } from './combat.actions'
import { UNIT_TYPES } from './combat.config'
import { applyStatus } from './combat.status'
import type { SimUnit } from './combat.sim.types'

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
    const before = killer.hp
    killer.hp = Math.min(killer.maxHp, killer.hp + healAmount)
    const actualHeal = killer.hp - before
    if (actualHeal > 0) {
      actions.push({ unitId: killer.id, type: 'heal', targetId: killer.id, damage: actualHeal })
    }
  }

  if (effect.status) {
    applyStatus(killer, { ...effect.status, sourceUnitId: killer.id }, actions)
  }
}

function hasUnitConfig(unitType: string): unitType is keyof typeof UNIT_TYPES {
  return unitType in UNIT_TYPES
}
