import { UNIT_TYPES } from './combat.config'
import type { ConditionalRangeConfig, SimUnit } from './combat.sim.types'
import { getEffectiveActionRange } from './combat.status'
import { getEffectiveCombatTags } from './combat.targeting-score'
import type { UnitTypeKey } from './combat.types'
import { getRankRelation } from './combat.rank-scaling'

const GRID_TO_PIXELS = 40

export function getMinimumActionRange(unit: SimUnit): number {
  return (UNIT_TYPES[unit.type as UnitTypeKey]?.baseStats.minimumRange ?? 0) * GRID_TO_PIXELS
}

export function getEffectiveActionRangeAgainst(unit: SimUnit, target: SimUnit): number {
  let range = getEffectiveActionRange(unit)
  for (const config of unit.conditionalRange ?? []) {
    if (!matchesConditionalRange(unit, target, config)) continue
    if (config.rangeMult !== undefined) range *= Math.max(0, config.rangeMult)
    if (config.rangeAdd !== undefined) range += config.rangeAdd
  }
  return Math.max(0, range)
}

export function getMaxEffectiveActionRange(unit: SimUnit): number {
  let range = getEffectiveActionRange(unit)
  for (const config of unit.conditionalRange ?? []) {
    let candidate = getEffectiveActionRange(unit)
    if (config.rangeMult !== undefined) candidate *= Math.max(0, config.rangeMult)
    if (config.rangeAdd !== undefined) candidate += config.rangeAdd
    range = Math.max(range, candidate)
  }
  return Math.max(0, range)
}

function matchesConditionalRange(unit: SimUnit, target: SimUnit, config: ConditionalRangeConfig): boolean {
  if (config.target === 'air') return target.isFlying
  if (config.target === 'ground') return !target.isFlying
  if (config.target === 'tag') return config.tag !== undefined && getEffectiveCombatTags(target).includes(config.tag)
  return getRankRelation(unit, target) === config.target
}
