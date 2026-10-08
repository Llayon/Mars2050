import type { UnitDefinition, UnitSpawnSpec } from './contracts/index.js'
import type { UnitBaseStats } from './combat.types.js'
import type { CombatCatalog, UpgradeConfig } from './combat.catalog.types.js'
import { calculateEffectiveUnitStats, type CompiledUnitStats } from './combat.unit-stat-compiler.js'
import { getRuntimePrimitiveStats } from './combat.upgrade-primitives.js'
import { assertValidWeaponLoadout } from './combat.weapon-validation.js'
import { compileAbilityDefinitions, AbilityCompilationError } from './combat.ability-compiler.js'
import { periodicAbility } from './combat.ability-config.js'
import { createLegacyAbilityDefinitions } from './combat.ability-legacy.js'
import { compileTemporalWeaponPlan } from './combat.temporal-compiler.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import { validatePeriodicAbilityConfig } from './combat.periodic-schema.js'
import { validateUnitSpawnPayloads } from './combat.payload-validator.js'
import { resolveEffectiveUnitBaseStats } from './combat.effective-loadout.js'

/**
 * Validates the assembled loadout (effective baseStats + upgrades) for a single unit spawn spec.
 * Ensures weapon geometries are compatible, targeting profiles exist, spawn references resolve,
 * and assembled abilities compile without duplicate IDs or unsupported combinations, before world creation or RNG consumption.
 */
export function validateUnitLoadout(
  unitIndex: number,
  unit: UnitSpawnSpec,
  baseStats: UnitBaseStats,
  upgradesCatalog?: Record<string, UpgradeConfig>,
  allDefIds?: Set<string>,
  allTargetingProfiles?: Set<string>,
  catalog?: CombatCatalog,
  definitions?: Record<string, UnitDefinition>,
): void {
  const def = definitions?.[unit.definitionId] ?? (catalog?.unitTypes?.[unit.definitionId] as unknown as UnitDefinition | undefined)
  const defPrep = def?.preparedStats
  const effectiveBase = resolveEffectiveUnitBaseStats(resolveEffectiveUnitBaseStats(baseStats, defPrep), unit.preparedStats)

  if (allTargetingProfiles && effectiveBase.targetingProfile && !allTargetingProfiles.has(effectiveBase.targetingProfile as string)) {
    throw new CombatDefinitionError(
      'MISSING_DEFINITION',
      `unit '${unit.instanceId}' references unknown targetingProfile '${effectiveBase.targetingProfile}'`,
      { path: `units[${unitIndex}].targetingProfile`, reference: String(effectiveBase.targetingProfile), definitionId: unit.definitionId },
    )
  }

  if (effectiveBase.attackType === 'spawn' && !effectiveBase.spawnType) {
    throw new CombatDefinitionError(
      'MISSING_SPAWN_TYPE',
      `unit '${unit.instanceId}' with attackType 'spawn' requires non-empty spawnType`,
      { path: `units[${unitIndex}].spawnType`, definitionId: unit.definitionId },
    )
  }

  if (effectiveBase.spawnType && allDefIds) {
    if (!allDefIds.has(effectiveBase.spawnType)) {
      throw new CombatDefinitionError(
        'MISSING_SPAWN_DEFINITION',
        `unit '${unit.instanceId}' spawns unknown definition '${effectiveBase.spawnType}'`,
        { path: `units[${unitIndex}].spawnType`, reference: effectiveBase.spawnType, definitionId: unit.definitionId },
      )
    }
    validateLateSpawnConfig(effectiveBase.spawnType, undefined, `units[${unitIndex}].spawnType`, catalog, definitions, effectiveBase.spawnOverrides)
  }

  const primitives = getRuntimePrimitiveStats(effectiveBase, unit.upgradeIds, upgradesCatalog, unit.preparedStats ?? defPrep)
  validateUnitSpawnPayloads(unitIndex, unit, primitives, allDefIds, catalog, definitions)

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
 * @param unitIndexOrPath Index of the unit in the units array or explicit path prefix.
 * @param unit Unit identification ({ instanceId, definitionId }).
 * @param stats Compiled effective stats for the unit.
 */
export function assertFiniteUnitStats(
  unitIndexOrPath: number | string,
  unit: { instanceId: string; definitionId: string },
  stats: CompiledUnitStats,
): void {
  const pfx = typeof unitIndexOrPath === 'number' ? `units[${unitIndexOrPath}].effectiveStats` : unitIndexOrPath
  const check = (val: number | undefined, name: string, cond: boolean, msg: string) => {
    if (!cond) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `unit '${unit.instanceId}' effective ${name} (${val}) ${msg}`,
        { path: `${pfx}.${name}`, reference: String(val), definitionId: unit.definitionId })
    }
  }
  check(stats.hp, 'hp', Number.isFinite(stats.hp) && stats.hp > 0, 'must be a positive finite number')
  check(stats.attack, 'attack', Number.isFinite(stats.attack) && stats.attack >= 0, 'must be a non-negative finite number')
  check(stats.defense, 'defense', Number.isFinite(stats.defense), 'must be a finite number')
  check(stats.speed, 'speed', Number.isFinite(stats.speed) && stats.speed >= 0, 'must be a non-negative finite number')
  check(stats.range, 'range', Number.isFinite(stats.range) && stats.range >= 0, 'must be a non-negative finite number')
  check(stats.cooldown, 'cooldown', Number.isFinite(stats.cooldown) && stats.cooldown > 0, 'must be a positive finite number')
  if (stats.shield !== undefined) check(stats.shield, 'shield', Number.isFinite(stats.shield) && stats.shield >= 0, 'must be a non-negative finite number')
}

/**
 * Validates effective stats and overrides for a late-spawned unit.
 */
export function validateLateSpawnConfig(
  spawnDefId: string,
  hpPercent: number | undefined,
  path: string,
  catalog?: CombatCatalog,
  definitions?: Record<string, UnitDefinition>,
  spawnOverrides?: { hp?: number; attack?: number; duration?: number },
): void {
  const stats = calculateEffectiveUnitStats(spawnDefId, 1, [], catalog, definitions)
  if (!stats) return
  assertFiniteUnitStats(path, { instanceId: spawnDefId, definitionId: spawnDefId }, stats)
  if (hpPercent !== undefined) {
    const scaled = stats.hp * hpPercent
    const effectiveHp = Math.max(1, Math.floor(scaled))
    if (!Number.isFinite(scaled) || !Number.isFinite(effectiveHp) || hpPercent <= 0) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `spawned unit '${spawnDefId}' effective hp (${effectiveHp}) must be a positive finite number`,
        { path: `${path}.hpPercent`, reference: String(hpPercent), definitionId: spawnDefId })
    }
  }
  if (spawnOverrides?.hp !== undefined && (!Number.isFinite(spawnOverrides.hp) || spawnOverrides.hp <= 0)) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE', `spawn override hp (${spawnOverrides.hp}) must be a positive finite number`,
      { path: `${path}.spawnOverrides.hp`, reference: String(spawnOverrides.hp), definitionId: spawnDefId })
  }
  if (spawnOverrides?.attack !== undefined && (!Number.isFinite(spawnOverrides.attack) || spawnOverrides.attack < 0)) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE', `spawn override attack (${spawnOverrides.attack}) must be a non-negative finite number`,
      { path: `${path}.spawnOverrides.attack`, reference: String(spawnOverrides.attack), definitionId: spawnDefId })
  }
  if (spawnOverrides?.duration !== undefined && (!Number.isFinite(spawnOverrides.duration) || spawnOverrides.duration <= 0)) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE', `spawn override duration (${spawnOverrides.duration}) must be a positive finite number`,
      { path: `${path}.spawnOverrides.duration`, reference: String(spawnOverrides.duration), definitionId: spawnDefId })
  }
}
