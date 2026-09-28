import { baseStatsSchema } from './contracts/unit.contracts.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import type { AbilityDefinition } from './combat.ability.types.js'
import type { PeriodicAbilityConfig } from './combat.sim.types.js'
import type { TargetingProfile, UnitBaseStats } from './combat.types.js'
import { validatePeriodicAbilityConfig } from './combat.periodic-schema.js'
import { validateDefinitionBaseLoadout } from './combat.loadout-validator.js'

export interface AnyDef {
  id?: string
  name?: string
  targetingProfile?: string
  squadSize?: number
  squadSpacing?: number
  abilities?: unknown[]
  periodicAbilities?: unknown[]
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
  const profile = def.targetingProfile ?? rawBase.targetingProfile
  if (profile && !allTargetingProfiles.has(profile as string)) {
    throw new CombatDefinitionError('MISSING_DEFINITION', `definition '${id}' references unknown targetingProfile '${profile}'`,
      { path: `${pathPrefix}.targetingProfile`, reference: String(profile), definitionId: id })
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

  const authoredAbilities = (def.abilities ?? rawBase.abilities) as AbilityDefinition[] | undefined
  if (authoredAbilities !== undefined && !Array.isArray(authoredAbilities)) {
    throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', `definition '${id}' abilities must be an array`,
      { path: `${pathPrefix}.abilities`, definitionId: id })
  }
  const rawPeriodic = (def as Record<string, unknown>).periodicAbilities
  const authoredPeriodic = (rawPeriodic ?? rawBase.periodicAbilities) as PeriodicAbilityConfig[] | undefined
  if (authoredPeriodic !== undefined && !Array.isArray(authoredPeriodic)) {
    throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', `definition '${id}' periodicAbilities must be an array`,
      { path: `${pathPrefix}.periodicAbilities`, definitionId: id })
  }
  if (Array.isArray(authoredPeriodic)) {
    for (let p = 0; p < authoredPeriodic.length; p++) {
      const pPath = rawPeriodic ? `${pathPrefix}.periodicAbilities[${p}]` : `${pathPrefix}.baseStats.periodicAbilities[${p}]`
      validatePeriodicAbilityConfig(authoredPeriodic[p], pPath, id)
    }
  }

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
