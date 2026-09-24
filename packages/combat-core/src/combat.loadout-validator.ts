import type { UnitSpawnSpec } from './contracts/index.js'
import type { UnitBaseStats } from './combat.types.js'
import type { UpgradeConfig } from './combat.catalog.types.js'
import { getRuntimePrimitiveStats } from './combat.upgrade-primitives.js'
import { assertValidWeaponLoadout } from './combat.weapon-validation.js'
import { compileAbilityDefinitions, AbilityCompilationError } from './combat.ability-compiler.js'
import { periodicAbility } from './combat.ability-config.js'
import { createLegacyAbilityDefinitions } from './combat.ability-legacy.js'
import { compileTemporalWeaponPlan } from './combat.temporal-compiler.js'
import { CombatDefinitionError } from './combat.definition-error.js'

/**
 * Validates the assembled loadout (baseStats + upgrades) for a single unit spawn spec.
 * Ensures weapon geometries are compatible and assembled abilities compile without duplicate IDs
 * or unsupported combinations, before world creation or RNG consumption.
 */
export function validateUnitLoadout(
  unitIndex: number,
  unit: UnitSpawnSpec,
  baseStats: UnitBaseStats,
  upgradesCatalog?: Record<string, UpgradeConfig>,
): void {
  const primitives = getRuntimePrimitiveStats(baseStats, unit.upgradeIds, upgradesCatalog)

  try {
    assertValidWeaponLoadout(unit.definitionId, primitives)
  } catch (err) {
    throw new CombatDefinitionError(
      'SCHEMA_VALIDATION_ERROR',
      `unit '${unit.instanceId}' weapon loadout error: ${err instanceof Error ? err.message : String(err)}`,
      { path: `units[${unitIndex}].loadout`, reference: unit.definitionId, definitionId: unit.definitionId },
    )
  }

  if (primitives.periodicAbilities && primitives.periodicAbilities.length > 0) {
    try {
      compileAbilityDefinitions(
        primitives.periodicAbilities.map(a => periodicAbility(`${unit.definitionId}:periodic:${a.id}`, a)),
      )
    } catch (err) {
      if (err instanceof AbilityCompilationError) {
        throw new CombatDefinitionError(
          'SCHEMA_VALIDATION_ERROR',
          `unit '${unit.instanceId}' periodic ability error: ${err.message}`,
          { path: `units[${unitIndex}].loadout.periodicAbilities`, reference: err.abilityId, definitionId: unit.definitionId },
        )
      }
      throw err
    }
  }

  try {
    const legacyAbilities = createLegacyAbilityDefinitions(unit.definitionId, primitives)
    const authoredAbilities = primitives.abilities ?? []
    const abilityPrograms = compileAbilityDefinitions([...legacyAbilities, ...authoredAbilities])
    compileTemporalWeaponPlan(unit.definitionId, primitives, abilityPrograms)
  } catch (err) {
    if (err instanceof AbilityCompilationError) {
      throw new CombatDefinitionError(
        'SCHEMA_VALIDATION_ERROR',
        `unit '${unit.instanceId}' ability error: ${err.message}`,
        { path: `units[${unitIndex}].loadout.abilities`, reference: err.abilityId, definitionId: unit.definitionId },
      )
    }
    throw err
  }
}
