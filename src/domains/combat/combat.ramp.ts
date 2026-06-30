import type { BattleAction } from './combat.actions'
import { UNIT_TYPES } from './combat.config'
import type { UnitTypeKey } from './combat.types'
import type { SimUnit } from './combat.sim.types'

/**
 * Applies same-target damage scaling for focused-fire units.
 *
 * @param attacker - Unit making the primary attack.
 * @param target - Current primary target.
 * @param baseDamage - Damage before ramp scaling.
 * @param actions - Replay action buffer.
 * @returns Damage after deterministic ramp scaling.
 */
export function getRampDamage(attacker: SimUnit, target: SimUnit, baseDamage: number, actions: BattleAction[]): number {
  const config = UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.rampDamage
  if (!config) return baseDamage

  const previousMultiplier = attacker.rampTargetId === target.id ? attacker.rampMultiplier ?? 1 : 1
  const multiplier = attacker.rampTargetId === target.id ? Math.min(config.maxMultiplier, previousMultiplier + config.step) : 1

  attacker.rampTargetId = target.id
  attacker.rampMultiplier = multiplier
  actions.push({ unitId: attacker.id, type: 'ramp_charge', targetId: target.id, value: multiplier })

  return Math.floor(baseDamage * multiplier)
}
