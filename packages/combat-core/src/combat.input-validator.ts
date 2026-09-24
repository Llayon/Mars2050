import { battleInputSchema, baseStatsSchema, type BattleInput } from './contracts/index.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import { TARGETING_PROFILES } from './combat.targeting.config.js'
import { calculateEffectiveMaxHp } from './combat.unit-stat-compiler.js'
import { compileAbilityDefinitions, AbilityCompilationError } from './combat.ability-compiler.js'
import { periodicAbility } from './combat.ability-config.js'
import type { CombatCatalog, UpgradeConfig } from './combat.catalog.types.js'
import type { AbilityDefinition } from './combat.ability.types.js'
import type { PeriodicAbilityConfig } from './combat.sim.types.js'
import type { UnitBaseStats } from './combat.types.js'
import { validateNestedSpawnPayloads, validateSummonCycles } from './combat.payload-validator.js'
import { validateDefinitionBaseLoadout, validateUnitLoadout } from './combat.loadout-validator.js'
import { validateUpgradeConfig } from './combat.upgrade-schema.js'

const SUPPORTED_SCHEDULED_EFFECT_KINDS = ['orbital_strike', 'mass_heal', 'mass_shield', 'global_emp']

interface AnyDef {
  id?: string; targetingProfile?: string; squadSize?: number; squadSpacing?: number; abilities?: unknown[]
  baseStats?: {
    hp?: number; attack?: number; defense?: number; speed?: number; range?: number; attackType?: string
    spawnType?: string; spawnCap?: number; targetingProfile?: string; statusOnHit?: Array<{ duration?: number }>
    abilities?: unknown[]; periodicAbilities?: PeriodicAbilityConfig[]
  }
}

export function validateBattleInput(input: unknown): BattleInput {
  const schemaResult = battleInputSchema.safeParse(input)
  if (!schemaResult.success) {
    const firstIssue = schemaResult.error.issues[0]
    const pathStr = firstIssue ? firstIssue.path.join('.') : ''
    throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR',
      `Schema validation failed: ${firstIssue ? firstIssue.message : 'invalid input'} at '${pathStr}'`,
      { path: pathStr, reference: String((firstIssue as unknown as { received?: unknown })?.received ?? ''),
        issues: schemaResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) })
  }
  const parsed = schemaResult.data

  for (const [key, def] of Object.entries(parsed.definitions)) {
    if (key !== def.id) {
      throw new CombatDefinitionError('INVALID_DEFINITION_KEY',
        `definition key '${key}' does not match definition id '${def.id}'`,
        { path: `definitions.${key}.id`, reference: def.id, definitionId: def.id })
    }
  }

  // 3. Collect accessible definitions and catalog components
  // Runtime precedence: definitions take priority over catalog for duplicate keys.
  const allDefs: Record<string, AnyDef> = {}
  const allDefIds = new Set<string>()
  for (const [k, v] of Object.entries(parsed.definitions)) { allDefs[k] = v; allDefIds.add(k) }
  const catUnitTypes = (parsed.catalog as { unitTypes?: Record<string, AnyDef> } | undefined)?.unitTypes
  if (catUnitTypes && typeof catUnitTypes === 'object') {
    for (const [k, v] of Object.entries(catUnitTypes)) {
      if (v) { allDefs[k] = v; allDefIds.add(k) }
    }
  }

  const allTargetingProfiles = new Set<string>(Object.keys(TARGETING_PROFILES))
  const catProfiles = (parsed.catalog as { targetingProfiles?: Record<string, unknown> } | undefined)?.targetingProfiles
  if (catProfiles && typeof catProfiles === 'object') Object.keys(catProfiles).forEach(k => allTargetingProfiles.add(k))

  const allUpgradeIds = new Set<string>()
  const catUpgrades = (parsed.catalog as {
    upgrades?: Record<string, UpgradeConfig>
  } | undefined)?.upgrades
  if (catUpgrades && typeof catUpgrades === 'object') {
    for (const [upgId, upg] of Object.entries(catUpgrades)) {
      validateUpgradeConfig(upgId, upg)
      allUpgradeIds.add(upgId)
      const uPer = upg.modifiers?.periodicAbilities
      if (Array.isArray(uPer)) {
        try { compileAbilityDefinitions(uPer.map(a => periodicAbility(`${upgId}:p:${a.id}`, a))) } catch (err) {
          if (err instanceof AbilityCompilationError) {
            throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', `upgrade '${upgId}' periodic ability error: ${err.message}`,
              { path: `catalog.upgrades.${upgId}.modifiers.periodicAbilities.${err.path}`, definitionId: upgId, reference: err.abilityId })
          }
          throw err
        }
      }
    }
  }

  // 4. Validate all nested spawn payloads across definitions and catalog upgrades
  validateNestedSpawnPayloads(allDefs, allDefIds, catUpgrades)

  // 5. Validate all definitions (baseStats structural schema, attackType, spawnType, targetingProfile, statusOnHit, abilities)
  for (const [id, def] of Object.entries(allDefs)) {
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
        {
          path: `definitions.${id}.baseStats${issuePath ? `.${issuePath}` : ''}`,
          definitionId: id,
          reference: String((firstIssue as unknown as { received?: unknown })?.received ?? ''),
          issues: baseStatsResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
        })
    }
    const attackType = def.baseStats.attackType
    if (attackType === 'beam' || attackType === 'spread') {
      throw new CombatDefinitionError('UNSUPPORTED_ATTACK_TYPE', id, attackType, { path: `definitions.${id}.baseStats.attackType`, reference: attackType })
    }
    if (attackType === 'spawn' && !def.baseStats.spawnType) {
      throw new CombatDefinitionError('MISSING_SPAWN_TYPE', `definition '${id}' with attackType 'spawn' requires non-empty spawnType`, { path: `definitions.${id}.baseStats.spawnType`, definitionId: id })
    }
    const profile = def.targetingProfile ?? def.baseStats.targetingProfile
    if (profile && !allTargetingProfiles.has(profile)) {
      throw new CombatDefinitionError('MISSING_DEFINITION', `definition '${id}' references unknown targetingProfile '${profile}'`, { path: `definitions.${id}.targetingProfile`, reference: profile, definitionId: id })
    }
    const isCat = !(id in parsed.definitions)
    const pathPrefix = isCat ? `catalog.unitTypes.${id}` : `definitions.${id}`
    if (def.squadSize !== undefined && (!Number.isInteger(def.squadSize) || def.squadSize < 1)) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `definition '${id}' squadSize (${def.squadSize}) must be a positive integer (>= 1)`,
        { path: `${pathPrefix}.squadSize`, reference: String(def.squadSize), definitionId: id })
    }
    if (def.squadSpacing !== undefined && (!Number.isFinite(def.squadSpacing) || def.squadSpacing < 0)) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `definition '${id}' squadSpacing (${def.squadSpacing}) must be a non-negative finite number`,
        { path: `${pathPrefix}.squadSpacing`, reference: String(def.squadSpacing), definitionId: id })
    }
    if (def.baseStats.statusOnHit) {
      for (let s = 0; s < def.baseStats.statusOnHit.length; s++) {
        const st = def.baseStats.statusOnHit[s]
        if (!st.duration || !Number.isInteger(st.duration) || st.duration <= 0) {
          throw new CombatDefinitionError('INVALID_FIELD_RANGE',
            `definition '${id}' statusOnHit[${s}] duration (${st.duration}) must be a positive integer`,
            { path: `${pathPrefix}.baseStats.statusOnHit[${s}].duration`, reference: String(st.duration), definitionId: id })
        }
      }
    }
    const authoredAbilities = (def.abilities ?? def.baseStats.abilities) as AbilityDefinition[] | undefined
    if (authoredAbilities !== undefined && !Array.isArray(authoredAbilities)) {
      throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', `definition '${id}' abilities must be an array`, { path: `${pathPrefix}.abilities`, definitionId: id })
    }
    const authoredPeriodic = ((def as { periodicAbilities?: unknown }).periodicAbilities ?? def.baseStats.periodicAbilities) as PeriodicAbilityConfig[] | undefined
    if (authoredPeriodic !== undefined && !Array.isArray(authoredPeriodic)) {
      throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', `definition '${id}' periodicAbilities must be an array`, { path: `${pathPrefix}.baseStats.periodicAbilities`, definitionId: id })
    }
    const baseStatsForLoadout = {
      ...(def.baseStats as Record<string, unknown>),
      abilities: authoredAbilities,
      periodicAbilities: authoredPeriodic,
    } as unknown as UnitBaseStats
    validateDefinitionBaseLoadout(id, baseStatsForLoadout, pathPrefix)
  }

  // 6. Units validation, squad member ID collision check, bounds check & loadout validation
  const seenInstanceIds = new Set<string>()
  const allMemberIds = new Set<string>()
  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    if (!allDefIds.has(u.definitionId)) {
      throw new CombatDefinitionError('MISSING_DEFINITION', `unit '${u.instanceId}' references unknown definitionId '${u.definitionId}'`,
        { path: `units[${i}].definitionId`, reference: u.definitionId })
    }
    if (seenInstanceIds.has(u.instanceId)) {
      throw new CombatDefinitionError('DUPLICATE_INSTANCE_ID', `duplicate unit instanceId '${u.instanceId}' at index ${i}`,
        { path: `units[${i}].instanceId`, reference: u.instanceId })
    }
    seenInstanceIds.add(u.instanceId)
    for (let j = 0; j < u.upgradeIds.length; j++) {
      const upgId = u.upgradeIds[j]
      if (!allUpgradeIds.has(upgId)) {
        throw new CombatDefinitionError('MISSING_DEFINITION', `unit '${u.instanceId}' references unknown upgradeId '${upgId}'`,
          { path: `units[${i}].upgradeIds[${j}]`, reference: upgId })
      }
    }
    const squadDef = parsed.definitions[u.definitionId] ?? catUnitTypes?.[u.definitionId]
    const squadSize = squadDef?.squadSize ?? 1
    if (!Number.isInteger(squadSize) || squadSize < 1) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `unit '${u.instanceId}' squadSize (${squadSize}) must be a positive integer (>= 1)`,
        { path: `units[${i}].squadSize`, reference: String(squadSize), definitionId: u.definitionId })
    }
    for (let s = 0; s < squadSize; s++) {
      const memberId = squadSize > 1 ? `${u.instanceId}_${s}` : u.instanceId
      if (allMemberIds.has(memberId)) {
        throw new CombatDefinitionError('DUPLICATE_SQUAD_MEMBER_ID', `squad member id collision for '${memberId}' at unit index ${i}`,
          { path: `units[${i}].instanceId`, reference: memberId })
      }
      allMemberIds.add(memberId)
    }
    if (u.placement.x != null && (u.placement.x < 0 || u.placement.x > parsed.arena.width)) {
      throw new CombatDefinitionError('OUT_OF_BOUNDS_COORDINATES',
        `unit '${u.instanceId}' x coordinate (${u.placement.x}) outside arena width (${parsed.arena.width})`,
        { path: `units[${i}].placement.x`, reference: String(u.placement.x) })
    }
    if (u.placement.y != null && (u.placement.y < 0 || u.placement.y > parsed.arena.height)) {
      throw new CombatDefinitionError('OUT_OF_BOUNDS_COORDINATES',
        `unit '${u.instanceId}' y coordinate (${u.placement.y}) outside arena height (${parsed.arena.height})`,
        { path: `units[${i}].placement.y`, reference: String(u.placement.y) })
    }
    if (u.currentHp != null) {
      const maxHp = calculateEffectiveMaxHp(u.definitionId, u.rank, u.upgradeIds, parsed.catalog as unknown as CombatCatalog | undefined, parsed.definitions)
      if (maxHp !== undefined && u.currentHp > maxHp + 1e-6) {
        throw new CombatDefinitionError('INVALID_FIELD_RANGE',
          `unit '${u.instanceId}' currentHp (${u.currentHp}) exceeds max hp (${maxHp})`,
          { path: `units[${i}].currentHp`, reference: String(u.currentHp) })
      }
    }

    validateUnitLoadout(i, u, allDefs[u.definitionId].baseStats as UnitBaseStats, catUpgrades)
  }

  // 7. Cycle check: only nodes actually participating in the cycle require spawnCap
  validateSummonCycles(allDefs)

  // 8. Coordinate and Arena Bounds
  for (let i = 0; i < parsed.arena.obstacles.length; i++) {
    const obs = parsed.arena.obstacles[i]
    if (obs.x < 0 || obs.x > parsed.arena.width || obs.y < 0 || obs.y > parsed.arena.height) {
      throw new CombatDefinitionError('OUT_OF_BOUNDS_COORDINATES',
        `obstacle at index ${i} coordinates (${obs.x}, ${obs.y}) outside arena bounds (${parsed.arena.width}x${parsed.arena.height})`,
        { path: `arena.obstacles[${i}]`, reference: `(${obs.x},${obs.y})` })
    }
  }

  for (let i = 0; i < parsed.scheduledEffects.length; i++) {
    const eff = parsed.scheduledEffects[i]
    if (!SUPPORTED_SCHEDULED_EFFECT_KINDS.includes(eff.type)) {
      throw new CombatDefinitionError('UNSUPPORTED_SCHEDULED_EFFECT', '', '',
        { effectId: eff.id, effectType: eff.type, path: `scheduledEffects[${i}].type`, reference: eff.type })
    }
    const isEmp = eff.type === 'global_emp'
    if (!Number.isFinite(eff.value) || eff.value <= 0 || (isEmp && !Number.isInteger(eff.value))) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `scheduled effect '${eff.id}' ${isEmp ? 'global_emp duration ' : ''}value (${eff.value}) must be a positive ${isEmp ? 'integer' : 'finite value'}`,
        { path: `scheduledEffects[${i}].value`, reference: String(eff.value) })
    }
  }

  return parsed
}
