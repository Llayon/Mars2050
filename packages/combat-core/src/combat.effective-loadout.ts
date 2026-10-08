import type { UnitBaseStats, TargetingProfileKey, CombatTag } from './combat.types.js'
import type { PreparedStats } from './contracts/prepared.contracts.js'

/**
 * Resolves the unified effective base stats for a unit by cleanly merging preparedStats over definition baseStats.
 * Shared across input validation, placement bounds checking, spawn compilation, and runtime unit building.
 */
export function resolveEffectiveUnitBaseStats(
  baseStats: UnitBaseStats,
  preparedStats?: PreparedStats,
): UnitBaseStats {
  if (!preparedStats) return baseStats

  const clean = Object.fromEntries(
    Object.entries(preparedStats).filter(([_, v]) => v !== undefined),
  )

  const effective: UnitBaseStats = {
    ...baseStats,
    ...clean,
    healTargetTags: (clean.healTargetTags ?? baseStats.healTargetTags) as CombatTag[] | undefined,
    combatTags: (clean.combatTags ?? baseStats.combatTags) as CombatTag[] | undefined,
    targetingProfile: (clean.targetingProfile ?? baseStats.targetingProfile) as TargetingProfileKey | undefined,
    periodicAbilities: (clean.periodicAbilities ?? baseStats.periodicAbilities) as UnitBaseStats['periodicAbilities'],
    triggerEffects: (clean.triggerEffects ?? baseStats.triggerEffects) as UnitBaseStats['triggerEffects'],
  }

  if (clean.burrowConfig && !clean.burrowWhileMoving) {
    effective.burrowWhileMoving = clean.burrowConfig as UnitBaseStats['burrowWhileMoving']
  }

  return effective
}

/**
 * Merges definition-level preparedStats and instance-level preparedStats.
 * Explicit instance values (including 0 and false) override definition values.
 * Omitted instance fields inherit from definition preparation.
 */
export function mergePreparedStats(
  defPrep?: PreparedStats,
  instancePrep?: PreparedStats,
): PreparedStats | undefined {
  if (!defPrep && !instancePrep) return undefined
  if (!defPrep) return instancePrep
  if (!instancePrep) return defPrep

  const cleanInstance = Object.fromEntries(
    Object.entries(instancePrep).filter(([_, v]) => v !== undefined),
  )
  return {
    ...defPrep,
    ...cleanInstance,
  } as PreparedStats
}
