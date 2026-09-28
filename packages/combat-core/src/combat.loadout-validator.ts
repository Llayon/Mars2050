import type { UnitSpawnSpec } from './contracts/index.js'
import type { UnitBaseStats } from './combat.types.js'
import type { UpgradeConfig } from './combat.catalog.types.js'
import type { CompiledUnitStats } from './combat.unit-stat-compiler.js'
import { getRuntimePrimitiveStats } from './combat.upgrade-primitives.js'
import { assertValidWeaponLoadout } from './combat.weapon-validation.js'
import { compileAbilityDefinitions, AbilityCompilationError } from './combat.ability-compiler.js'
import { periodicAbility } from './combat.ability-config.js'
import { createLegacyAbilityDefinitions } from './combat.ability-legacy.js'
import { compileTemporalWeaponPlan } from './combat.temporal-compiler.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import { validatePeriodicAbilityConfig } from './combat.periodic-schema.js'

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
    for (let p = 0; p < primitives.periodicAbilities.length; p++) {
      validatePeriodicAbilityConfig(
        primitives.periodicAbilities[p],
        `units[${unitIndex}].loadout.periodicAbilities[${p}]`,
        unit.definitionId,
      )
    }
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

/**
 * Validates the base loadout for a definition in allDefs (including definitions reachable via late summons).
 * Ensures weapon geometries are compatible and assembled abilities compile without duplicate IDs
 * or unsupported combinations, before world creation or RNG consumption.
 *
 * @param definitionId Unique identifier of the definition.
 * @param baseStats The base stats configuration of the unit.
 * @param pathPrefix Path prefix for error reporting (e.g. definitions.foo or catalog.unitTypes.foo).
 */
export function validateDefinitionBaseLoadout(
  definitionId: string,
  baseStats: UnitBaseStats,
  pathPrefix: string = `definitions.${definitionId}`,
): void {
  const primitives = getRuntimePrimitiveStats(baseStats, [], undefined)

  try {
    assertValidWeaponLoadout(definitionId, primitives)
  } catch (err) {
    throw new CombatDefinitionError(
      'SCHEMA_VALIDATION_ERROR',
      `definition '${definitionId}' weapon loadout error: ${err instanceof Error ? err.message : String(err)}`,
      { path: `${pathPrefix}.baseStats`, reference: definitionId, definitionId },
    )
  }

  if (primitives.periodicAbilities && primitives.periodicAbilities.length > 0) {
    for (let p = 0; p < primitives.periodicAbilities.length; p++) {
      validatePeriodicAbilityConfig(
        primitives.periodicAbilities[p],
        `${pathPrefix}.baseStats.periodicAbilities[${p}]`,
        definitionId,
      )
    }
    try {
      compileAbilityDefinitions(
        primitives.periodicAbilities.map(a => periodicAbility(`${definitionId}:periodic:${a.id}`, a)),
      )
    } catch (err) {
      if (err instanceof AbilityCompilationError) {
        throw new CombatDefinitionError(
          'SCHEMA_VALIDATION_ERROR',
          `definition '${definitionId}' periodic ability error: ${err.message}`,
          { path: `${pathPrefix}.baseStats.periodicAbilities`, reference: err.abilityId, definitionId },
        )
      }
      throw err
    }
  }

  try {
    const legacyAbilities = createLegacyAbilityDefinitions(definitionId, primitives)
    const authoredAbilities = primitives.abilities ?? []
    const abilityPrograms = compileAbilityDefinitions([...legacyAbilities, ...authoredAbilities])
    compileTemporalWeaponPlan(definitionId, primitives, abilityPrograms)
  } catch (err) {
    if (err instanceof AbilityCompilationError) {
      throw new CombatDefinitionError(
        'SCHEMA_VALIDATION_ERROR',
        `definition '${definitionId}' ability error: ${err.message}`,
        { path: `${pathPrefix}.abilities`, reference: err.abilityId, definitionId },
      )
    }
    throw err
  }
}

/**
 * Asserts that the effective calculated unit stats after modifiers are finite and within valid ranges.
 *
 * @param unitIndex Index of the unit in the units array.
 * @param unit Unit spawn specification.
 * @param stats Compiled effective stats for the unit.
 */
export function assertFiniteUnitStats(
  unitIndex: number,
  unit: UnitSpawnSpec,
  stats: CompiledUnitStats,
): void {
  if (!Number.isFinite(stats.hp) || stats.hp <= 0) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE',
      `unit '${unit.instanceId}' effective hp (${stats.hp}) must be a positive finite number`,
      { path: `units[${unitIndex}].effectiveStats.hp`, reference: String(stats.hp), definitionId: unit.definitionId })
  }
  if (!Number.isFinite(stats.attack) || stats.attack < 0) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE',
      `unit '${unit.instanceId}' effective attack (${stats.attack}) must be a non-negative finite number`,
      { path: `units[${unitIndex}].effectiveStats.attack`, reference: String(stats.attack), definitionId: unit.definitionId })
  }
  if (!Number.isFinite(stats.defense)) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE',
      `unit '${unit.instanceId}' effective defense (${stats.defense}) must be a finite number`,
      { path: `units[${unitIndex}].effectiveStats.defense`, reference: String(stats.defense), definitionId: unit.definitionId })
  }
  if (!Number.isFinite(stats.speed) || stats.speed < 0) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE',
      `unit '${unit.instanceId}' effective speed (${stats.speed}) must be a non-negative finite number`,
      { path: `units[${unitIndex}].effectiveStats.speed`, reference: String(stats.speed), definitionId: unit.definitionId })
  }
  if (!Number.isFinite(stats.range) || stats.range < 0) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE',
      `unit '${unit.instanceId}' effective range (${stats.range}) must be a non-negative finite number`,
      { path: `units[${unitIndex}].effectiveStats.range`, reference: String(stats.range), definitionId: unit.definitionId })
  }
  if (!Number.isFinite(stats.cooldown) || stats.cooldown <= 0) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE',
      `unit '${unit.instanceId}' effective cooldown (${stats.cooldown}) must be a positive finite number`,
      { path: `units[${unitIndex}].effectiveStats.cooldown`, reference: String(stats.cooldown), definitionId: unit.definitionId })
  }
  if (stats.shield !== undefined && (!Number.isFinite(stats.shield) || stats.shield < 0)) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE',
      `unit '${unit.instanceId}' effective shield (${stats.shield}) must be a non-negative finite number`,
      { path: `units[${unitIndex}].effectiveStats.shield`, reference: String(stats.shield), definitionId: unit.definitionId })
  }
}
