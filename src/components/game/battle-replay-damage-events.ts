import type { BattleAction, BattleTick } from '@/domains/combat/combat.types'

const DETAILED_DAMAGE_TYPES = new Set<BattleAction['type']>([
  'damage',
  'damage_share',
  'shield_damage',
  'shield_break',
  'lifesteal',
  'unit_blocked_damage',
])

/**
 * Detects logs that carry the new detailed damage stream.
 * @param logs Replay ticks to inspect
 * @returns true when legacy attack actions should not mutate HP
 */
export function hasDetailedDamageEvents(logs: BattleTick[]): boolean {
  return logs.some(log => log.actions.some(action => isDetailedDamageAction(action.type)))
}

/**
 * Checks whether an action is part of the detailed damage stream.
 * @param type Replay action type
 * @returns true for detailed damage events
 */
export function isDetailedDamageAction(type: BattleAction['type']): boolean {
  return DETAILED_DAMAGE_TYPES.has(type)
}
