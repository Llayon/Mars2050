import { battleInputSchema, type BattleInput, type BaseStats, type UnitDefinition, type Formation } from './contracts/index.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import { TARGETING_PROFILES } from './combat.targeting.config.js'
import { calculateEffectiveUnitStats } from './combat.unit-stat-compiler.js'
import { compileAbilityDefinitions, AbilityCompilationError } from './combat.ability-compiler.js'
import { periodicAbility } from './combat.ability-config.js'
import type { CombatCatalog, UpgradeConfig } from './combat.catalog.types.js'
import type { UnitBaseStats, UnitTypeConfig, TargetingProfile } from './combat.types.js'
import { validateNestedSpawnPayloads, validateSummonCycles } from './combat.payload-validator.js'
import { assertFiniteUnitStats, validateUnitLoadout } from './combat.loadout-validator.js'
import { validateUpgradeConfig } from './combat.upgrade-schema.js'
import { validatePeriodicAbilityConfig } from './combat.periodic-schema.js'
import { validateAndNormalizeDefinition, type AnyDef, type NormalizedDefinition } from './combat.definition-validator.js'
import { validatePlacementAndBounds } from './combat.placement-validator.js'

const SUPPORTED_SCHEDULED_EFFECT_KINDS = ['orbital_strike', 'mass_heal', 'mass_shield', 'global_emp']

export function validateBattleInput(input: unknown): BattleInput {
  const schemaResult = battleInputSchema.safeParse(input)
  if (!schemaResult.success) {
    const firstIssue = schemaResult.error.issues[0]
    const pathStr = firstIssue ? firstIssue.path.join('.') : ''
    let msg = `Schema validation failed: ${firstIssue ? firstIssue.message : 'invalid input'} at '${pathStr}'`
    let defId: string | undefined
    if (firstIssue && firstIssue.path[0] === 'catalog' && firstIssue.path[1] === 'upgrades' && firstIssue.path[2]) {
      defId = String(firstIssue.path[2])
      msg = `upgrade '${defId}' validation failed: ${msg}`
    }
    throw new CombatDefinitionError('SCHEMA_VALIDATION_ERROR', msg, {
      path: pathStr,
      definitionId: defId,
      reference: String((firstIssue as unknown as { received?: unknown })?.received ?? ''),
      issues: schemaResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  const parsed = schemaResult.data

  for (const [key, def] of Object.entries(parsed.definitions)) {
    if (key !== def.id) {
      throw new CombatDefinitionError('INVALID_DEFINITION_KEY',
        `definition key '${key}' does not match definition id '${def.id}'`,
        { path: `definitions.${key}.id`, reference: def.id, definitionId: def.id })
    }
  }

  // 3. Build sets of known IDs and targeting profiles
  const allDefIds = new Set<string>()
  for (const k of Object.keys(parsed.definitions)) allDefIds.add(k)
  const catUnitTypes = (parsed.catalog as { unitTypes?: Record<string, AnyDef> } | undefined)?.unitTypes
  if (catUnitTypes && typeof catUnitTypes === 'object') {
    for (const k of Object.keys(catUnitTypes)) allDefIds.add(k)
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
        for (let p = 0; p < uPer.length; p++) {
          validatePeriodicAbilityConfig(uPer[p], `catalog.upgrades.${upgId}.modifiers.periodicAbilities[${p}]`, upgId)
        }
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

  // 4. Validate and normalize all definitions in parsed.definitions and catalog.unitTypes
  const normDefs: Record<string, NormalizedDefinition> = {}
  for (const [id, def] of Object.entries(parsed.definitions)) {
    normDefs[id] = validateAndNormalizeDefinition(id, def as AnyDef, `definitions.${id}`, allTargetingProfiles)
  }
  const normCatDefs: Record<string, NormalizedDefinition> = {}
  if (catUnitTypes && typeof catUnitTypes === 'object') {
    for (const [id, def] of Object.entries(catUnitTypes)) {
      if (def) {
        normCatDefs[id] = validateAndNormalizeDefinition(id, def, `catalog.unitTypes.${id}`, allTargetingProfiles)
      }
    }
  }

  // Merge into allDefs with runtime priority:
  // Combat stats/abilities/references come from catalog.unitTypes over definitions.
  // squadSize/squadSpacing/formation preserve public definitions priority over catalog.unitTypes.
  const allDefs: Record<string, NormalizedDefinition> = { ...normDefs }
  for (const [id, catDef] of Object.entries(normCatDefs)) {
    const pubDef = allDefs[id]
    if (pubDef) {
      allDefs[id] = {
        ...catDef,
        squadSize: pubDef.squadSize ?? catDef.squadSize,
        squadSpacing: pubDef.squadSpacing ?? catDef.squadSpacing,
        formation: pubDef.formation ?? catDef.formation,
      }
    } else {
      allDefs[id] = catDef
    }
  }

  const normalizedDefinitions: Record<string, UnitDefinition> = {}
  for (const [id, normDef] of Object.entries(normDefs)) {
    const origDef = parsed.definitions[id]
    normalizedDefinitions[id] = {
      ...origDef,
      id: normDef.id ?? id,
      name: normDef.name ?? origDef.name,
      squadSize: normDef.squadSize ?? origDef.squadSize,
      squadSpacing: normDef.squadSpacing ?? origDef.squadSpacing,
      formation: (normDef.formation as Formation | undefined) ?? origDef.formation,
      targetingProfile: (normDef.targetingProfile as string | undefined) ?? origDef.targetingProfile,
      abilities: (normDef.abilities as unknown[] | undefined) ?? origDef.abilities,
      periodicAbilities: normDef.periodicAbilities as unknown[] | undefined,
      baseStats: {
        ...origDef.baseStats,
        ...normDef.baseStats,
        actionCooldownMax: normDef.baseStats.actionCooldownMax ?? origDef.baseStats.actionCooldownMax ?? 10,
        turnSpeed: normDef.baseStats.turnSpeed ?? origDef.baseStats.turnSpeed ?? 5,
        size: normDef.baseStats.size ?? origDef.baseStats.size ?? 'M',
        combatTags: (normDef.baseStats.combatTags as string[]) ?? origDef.baseStats.combatTags ?? [],
        attackType: normDef.baseStats.attackType,
      },
    }
  }

  const normalizedCatalogUnitTypes: Record<string, UnitTypeConfig> = {}
  if (catUnitTypes && typeof catUnitTypes === 'object') {
    for (const [id, normDef] of Object.entries(normCatDefs)) {
      const origCat = catUnitTypes[id] as Record<string, unknown>
      normalizedCatalogUnitTypes[id] = {
        ...origCat,
        name: normDef.name ?? (origCat.name as string),
        baseStats: normDef.baseStats,
        hireCost: (origCat.hireCost as Record<string, number>) ?? {},
        recruitable: origCat.recruitable as boolean | undefined,
        squadSize: normDef.squadSize,
        squadSpacing: normDef.squadSpacing,
        formation: normDef.formation as 'line' | 'wedge' | 'grid' | undefined,
      }
    }
  }
  const normalizedCatalog: Record<string, unknown> | undefined = parsed.catalog
    ? { ...parsed.catalog, unitTypes: normalizedCatalogUnitTypes }
    : undefined

  // 5. Validate all nested spawn payloads across definitions and catalog upgrades
  validateNestedSpawnPayloads(allDefs, allDefIds, catUpgrades, normalizedCatalog as unknown as CombatCatalog, normalizedDefinitions)

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
    const squadDef = allDefs[u.definitionId]
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
    const effective = calculateEffectiveUnitStats(u.definitionId, u.rank, u.upgradeIds, normalizedCatalog as unknown as CombatCatalog | undefined, normalizedDefinitions, u.preparedStats)
    if (effective) {
      assertFiniteUnitStats(i, u, effective)
      if (u.currentHp != null && u.currentHp > effective.hp + 1e-6) {
        throw new CombatDefinitionError('INVALID_FIELD_RANGE',
          `unit '${u.instanceId}' currentHp (${u.currentHp}) exceeds max hp (${effective.hp})`,
          { path: `units[${i}].currentHp`, reference: String(u.currentHp) })
      }
    }

    validateUnitLoadout(i, u, allDefs[u.definitionId].baseStats, catUpgrades)
  }

  // 7. Cycle check: only nodes actually participating in the cycle require spawnCap
  validateSummonCycles(allDefs)

  // 8. Coordinate, squad, and arena deployment bounds
  validatePlacementAndBounds(parsed, allDefs)

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

  return {
    ...parsed,
    definitions: normalizedDefinitions,
    catalog: normalizedCatalog,
  }
}
