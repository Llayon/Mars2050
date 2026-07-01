import { UNIT_TYPES } from './combat.config'
import { getEffectiveCombatTags } from './combat.targeting-score'
import type { SimUnit } from './combat.sim.types'
import type { UnitTypeKey } from './combat.types'

/**
 * Checks whether a healing/support action may affect a target.
 * @param source Unit performing the healing action
 * @param target Potential recipient
 * @returns true when no tag filter is configured or the target has a matching tag
 */
export function canReceiveHealAction(source: SimUnit, target: SimUnit): boolean {
  const targetTags = UNIT_TYPES[source.type as UnitTypeKey]?.baseStats.healTargetTags
  if (!targetTags || targetTags.length === 0) return true

  const effectiveTags = new Set(getEffectiveCombatTags(target))
  return targetTags.some(tag => effectiveTags.has(tag))
}
