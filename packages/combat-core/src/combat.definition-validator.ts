import { baseStatsSchema } from './contracts/unit.contracts.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import type { AbilityDefinition } from './combat.ability.types.js'
import type { PeriodicAbilityConfig } from './combat.sim.types.js'
import type { TargetingProfile, UnitBaseStats } from './combat.types.js'
import { validatePeriodicAbilityConfig } from './combat.periodic-schema.js'
import { validateDefinitionBaseLoadout } from './combat.loadout-validator.js'

import type { PreparedStats } from './contracts/prepared.contracts.js'

export interface AnyDef {
  id?: string
  name?: string
  targetingProfile?: string
  squadSize?: number
  squadSpacing?: number
  abilities?: unknown[]
  periodicAbilities?: unknown[]
  preparedStats?: PreparedStats
  baseStats?: UnitBaseStats | Record<string, unknown>
}

export interface NormalizedDefinition {
  id?: string
  name?: string
  targetingProfile?: string
  squadSize?: number
  squadSpacing?: number
  formation?: string
  abilities?: AbilityDefinition[]
  periodicAbilities?: PeriodicAbilityConfig[]
  preparedStats?: PreparedStats
  baseStats: UnitBaseStats
}

/**
 * Validates a single unit definition and returns a normalized local copy with authored abilities.
 * Does not mutate the input definition or its baseStats, supporting frozen catalogs and definitions.
 *
 * @param id Unique identifier of the definition.
 * @param def The raw definition object.
 * @param pathPrefix Path prefix for error reporting (e.g. definitions.foo or catalog.unitTypes.foo).
 * @param allTargetingProfiles Set of known valid targeting profiles.
 * @returns The normalized definition object.
 */
export function validateAndNormalizeDefinition(
  id: string,
  def: AnyDef,
  pathPrefix: string,
  allTargetingProfiles: Set<string>,
): NormalizedDefinition {
  if (!def || typeof def !== 'object' || !def.baseStats || typeof def.baseStats !== 'object') {
    throw new CombatDefinitionError('MISSING_DEFINITION', `definition '${id}' is missing baseStats`,
      { path: `definitions.${id}.baseStats`, definitionId: id })
  }
  const baseStatsResult = baseStatsSchema.passthrough().safeParse(def.baseStats)
  if (!baseStatsResult.success) {
    const firstIssue = baseStatsResult.error.issues[0]
    const issuePath = firstIssue ? firstIssue.path.join('.') : ''
    throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR',
      `definition '${id}' baseStats validation failed: ${firstIssue ? firstIssue.message : 'invalid baseStats'} at '${issuePath}'`,
      { path: `${pathPrefix}.baseStats${issuePath ? `.${issuePath}` : ''}`, definitionId: id,
        reference: String((firstIssue as unknown as { received?: unknown })?.received ?? ''),
        issues: baseStatsResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) })
  }
  const rawBase = def.baseStats as Record<string, unknown>
  const attackType = rawBase.attackType
  if (attackType === 'beam' || attackType === 'spread') {
    throw new CombatDefinitionError('UNSUPPORTED_ATTACK_TYPE', id, String(attackType),
      { path: `${pathPrefix}.baseStats.attackType`, reference: String(attackType) })
  }
  if (attackType === 'spawn' && !rawBase.spawnType) {
    throw new CombatDefinitionError('MISSING_SPAWN_TYPE', `definition '${id}' with attackType 'spawn' requires non-empty spawnType`,
      { path: `${pathPrefix}.baseStats.spawnType`, definitionId: id })
  }
  if (def.targetingProfile && !allTargetingProfiles.has(def.targetingProfile)) {
    throw new CombatDefinitionError('MISSING_DEFINITION', `definition '${id}' references unknown targetingProfile '${def.targetingProfile}'`,
      { path: `${pathPrefix}.targetingProfile`, reference: String(def.targetingProfile), definitionId: id })
  }
  if (rawBase.targetingProfile && !allTargetingProfiles.has(rawBase.targetingProfile as string)) {
    throw new CombatDefinitionError('MISSING_DEFINITION', `definition '${id}' references unknown targetingProfile '${rawBase.targetingProfile}'`,
      { path: `${pathPrefix}.baseStats.targetingProfile`, reference: String(rawBase.targetingProfile), definitionId: id })
  }
  if (def.squadSize !== undefined && (!Number.isInteger(def.squadSize) || def.squadSize < 1)) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE', `definition '${id}' squadSize (${def.squadSize}) must be a positive integer (>= 1)`,
      { path: `${pathPrefix}.squadSize`, reference: String(def.squadSize), definitionId: id })
  }
  if (def.squadSpacing !== undefined && (!Number.isFinite(def.squadSpacing) || def.squadSpacing < 0)) {
    throw new CombatDefinitionError('INVALID_FIELD_RANGE', `definition '${id}' squadSpacing (${def.squadSpacing}) must be a non-negative finite number`,
      { path: `${pathPrefix}.squadSpacing`, reference: String(def.squadSpacing), definitionId: id })
  }
  if (Array.isArray(rawBase.statusOnHit)) {
    for (let s = 0; s < rawBase.statusOnHit.length; s++) {
      const st = rawBase.statusOnHit[s] as { duration?: number }
      if (!st.duration || !Number.isInteger(st.duration) || st.duration <= 0) {
        throw new CombatDefinitionError('INVALID_FIELD_RANGE', `definition '${id}' statusOnHit[${s}] duration (${st.duration}) must be a positive integer`,
          { path: `${pathPrefix}.baseStats.statusOnHit[${s}].duration`, reference: String(st.duration), definitionId: id })
      }
    }
  }
  if (rawBase.spawnOverrides && typeof rawBase.spawnOverrides === 'object') {
    const so = rawBase.spawnOverrides as { hp?: number; attack?: number; duration?: number }
    if (so.hp !== undefined && (!Number.isFinite(so.hp) || so.hp <= 0)) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `definition '${id}' spawnOverrides.hp (${so.hp}) must be a positive finite number`,
        { path: `${pathPrefix}.baseStats.spawnOverrides.hp`, reference: String(so.hp), definitionId: id })
    }
    if (so.attack !== undefined && (!Number.isFinite(so.attack) || so.attack < 0)) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `definition '${id}' spawnOverrides.attack (${so.attack}) must be a non-negative finite number`,
        { path: `${pathPrefix}.baseStats.spawnOverrides.attack`, reference: String(so.attack), definitionId: id })
    }
    if (so.duration !== undefined && (!Number.isFinite(so.duration) || so.duration <= 0)) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `definition '${id}' spawnOverrides.duration (${so.duration}) must be a positive finite number`,
        { path: `${pathPrefix}.baseStats.spawnOverrides.duration`, reference: String(so.duration), definitionId: id })
    }
  }

  const rawBaseAbilities = rawBase.abilities
  if (rawBaseAbilities !== undefined && !Array.isArray(rawBaseAbilities)) {
    throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', `definition '${id}' baseStats.abilities must be an array`,
      { path: `${pathPrefix}.baseStats.abilities`, definitionId: id })
  }
  const rawTopAbilities = def.abilities
  if (rawTopAbilities !== undefined && !Array.isArray(rawTopAbilities)) {
    throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', `definition '${id}' abilities must be an array`,
      { path: `${pathPrefix}.abilities`, definitionId: id })
  }
  const authoredAbilities = (rawTopAbilities ?? rawBaseAbilities) as AbilityDefinition[] | undefined

  const rawBasePeriodic = rawBase.periodicAbilities
  if (rawBasePeriodic !== undefined && !Array.isArray(rawBasePeriodic)) {
    throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', `definition '${id}' baseStats.periodicAbilities must be an array`,
      { path: `${pathPrefix}.baseStats.periodicAbilities`, definitionId: id })
  }
  if (Array.isArray(rawBasePeriodic)) {
    for (let p = 0; p < rawBasePeriodic.length; p++) {
      validatePeriodicAbilityConfig(rawBasePeriodic[p], `${pathPrefix}.baseStats.periodicAbilities[${p}]`, id)
    }
  }
  const rawTopPeriodic = (def as Record<string, unknown>).periodicAbilities
  if (rawTopPeriodic !== undefined && !Array.isArray(rawTopPeriodic)) {
    throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', `definition '${id}' periodicAbilities must be an array`,
      { path: `${pathPrefix}.periodicAbilities`, definitionId: id })
  }
  if (Array.isArray(rawTopPeriodic)) {
    for (let p = 0; p < rawTopPeriodic.length; p++) {
      validatePeriodicAbilityConfig(rawTopPeriodic[p], `${pathPrefix}.periodicAbilities[${p}]`, id)
    }
  }
  const authoredPeriodic = (rawTopPeriodic ?? rawBasePeriodic) as PeriodicAbilityConfig[] | undefined

  const normalizedBaseStats = {
    ...rawBase,
    abilities: authoredAbilities,
    periodicAbilities: authoredPeriodic,
    targetingProfile: (def.targetingProfile ?? rawBase.targetingProfile) as TargetingProfile | undefined,
  } as unknown as UnitBaseStats

  validateDefinitionBaseLoadout(id, normalizedBaseStats, pathPrefix)
  return {
    ...def,
    id: def.id ?? id,
    abilities: authoredAbilities,
    periodicAbilities: authoredPeriodic,
    baseStats: normalizedBaseStats,
  }
}
