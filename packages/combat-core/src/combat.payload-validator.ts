import type { PeriodicAbilityConfig, TriggerEffectConfig } from './combat.sim.types.js'
import type { AbilityDefinition } from './combat.ability.types.js'
import type { CombatCatalog, UpgradeConfig } from './combat.catalog.types.js'
import type { UnitDefinition } from './contracts/index.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import { validateLateSpawnConfig } from './combat.loadout-validator.js'

export interface DefWithPayloads {
  id?: string
  abilities?: unknown[]
  periodicAbilities?: unknown[]
  preparedStats?: {
    spawnType?: string
    periodicAbilities?: unknown[]
    triggerEffects?: unknown[]
    spawnerConfig?: { unitType?: string; interval?: number; timer?: number }
  }
  baseStats?: {
    spawnType?: string
    spawnOverrides?: { hp?: number; attack?: number; duration?: number }
    periodicAbilities?: unknown[]
    triggerEffects?: TriggerEffectConfig[]
    abilities?: unknown[]
    spawnerConfig?: { unitType?: string; interval?: number; timer?: number }
  }
}

/**
 * Validates all nested spawn references and late creation effective stats in periodic abilities,
 * trigger effects, authored abilities, and catalog upgrades.
 */
function validateSpawnPayloadItems(
  items: unknown[] | undefined,
  basePath: string,
  ownerType: 'definition' | 'upgrade' | 'unit',
  ownerId: string,
  kindName: string,
  allDefIds: Set<string>,
  catalog?: CombatCatalog,
  definitions?: Record<string, UnitDefinition>,
): void {
  if (!Array.isArray(items)) return
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as { id?: string; payload?: { kind?: string; unitType?: string; hpPercent?: number } } | undefined
    if (item?.payload && typeof item.payload === 'object' && item.payload.kind === 'spawn') {
      const p = item.payload
      if (!p.unitType || !allDefIds.has(p.unitType)) {
        throw new CombatDefinitionError(
          'MISSING_SPAWN_DEFINITION',
          `${ownerType} '${ownerId}' ${kindName} '${item.id ?? i}' spawns unknown definition '${p.unitType ?? ''}'`,
          { path: `${basePath}[${i}].payload.unitType`, reference: p.unitType, definitionId: ownerId },
        )
      }
      validateLateSpawnConfig(p.unitType, p.hpPercent, `${basePath}[${i}].payload`, catalog, definitions)
    }
  }
}

/**
 * Validates all nested spawn references and late creation effective stats in periodic abilities,
 * trigger effects, authored abilities, and catalog upgrades.
 */
export function validateNestedSpawnPayloads(
  allDefs: Record<string, DefWithPayloads>,
  allDefIds: Set<string>,
  catUpgrades?: Record<string, UpgradeConfig>,
  catalog?: CombatCatalog,
  definitions?: Record<string, UnitDefinition>,
): void {
  if (catUpgrades && typeof catUpgrades === 'object') {
    for (const [upgId, upg] of Object.entries(catUpgrades)) {
      if (!upg || typeof upg !== 'object') continue
      const mods = upg.modifiers
      if (!mods) continue

      if (mods.periodicSpawn?.unit) {
        if (!allDefIds.has(mods.periodicSpawn.unit)) {
          throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `upgrade '${upgId}' periodicSpawn references unknown definition '${mods.periodicSpawn.unit}'`,
            { path: `catalog.upgrades.${upgId}.modifiers.periodicSpawn.unit`, reference: mods.periodicSpawn.unit, definitionId: upgId })
        }
        validateLateSpawnConfig(mods.periodicSpawn.unit, undefined, `catalog.upgrades.${upgId}.modifiers.periodicSpawn`, catalog, definitions)
      }
      if (mods.onDeathSpawn) {
        if (!allDefIds.has(mods.onDeathSpawn)) {
          throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `upgrade '${upgId}' onDeathSpawn references unknown definition '${mods.onDeathSpawn}'`,
            { path: `catalog.upgrades.${upgId}.modifiers.onDeathSpawn`, reference: mods.onDeathSpawn, definitionId: upgId })
        }
        validateLateSpawnConfig(mods.onDeathSpawn, undefined, `catalog.upgrades.${upgId}.modifiers.onDeathSpawn`, catalog, definitions)
      }
      validateSpawnPayloadItems(mods.periodicAbilities, `catalog.upgrades.${upgId}.modifiers.periodicAbilities`, 'upgrade', upgId, 'periodicAbility', allDefIds, catalog, definitions)
      validateSpawnPayloadItems(mods.triggerEffects, `catalog.upgrades.${upgId}.modifiers.triggerEffects`, 'upgrade', upgId, 'triggerEffect', allDefIds, catalog, definitions)
    }
  }

  for (const [id, def] of Object.entries(allDefs)) {
    if (!def || typeof def !== 'object') continue
    const base = def.baseStats
    if (base && typeof base === 'object') {
      const spawnType = def.preparedStats?.spawnType ?? base.spawnType
      if (spawnType) {
        if (!allDefIds.has(spawnType)) {
          throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `definition '${id}' spawns unknown definition '${spawnType}'`,
            { path: def.preparedStats?.spawnType ? `definitions.${id}.preparedStats.spawnType` : `definitions.${id}.baseStats.spawnType`, reference: spawnType, definitionId: id })
        }
        validateLateSpawnConfig(spawnType, undefined, def.preparedStats?.spawnType ? `definitions.${id}.preparedStats.spawnType` : `definitions.${id}.baseStats.spawnType`, catalog, definitions, base.spawnOverrides)
      }
      validateSpawnPayloadItems(base.periodicAbilities, `definitions.${id}.baseStats.periodicAbilities`, 'definition', id, 'periodicAbility', allDefIds, catalog, definitions)
      validateSpawnPayloadItems(base.triggerEffects, `definitions.${id}.baseStats.triggerEffects`, 'definition', id, 'triggerEffect', allDefIds, catalog, definitions)
      validateAbilityListSpawns('definition', id, `definitions.${id}.baseStats.abilities`, base.abilities, allDefIds, catalog, definitions)
    }
    validateSpawnPayloadItems(def.periodicAbilities, `definitions.${id}.periodicAbilities`, 'definition', id, 'periodicAbility', allDefIds, catalog, definitions)
    validateAbilityListSpawns('definition', id, `definitions.${id}.abilities`, def.abilities, allDefIds, catalog, definitions)
    if (def.preparedStats) {
      validateSpawnPayloadItems(def.preparedStats.periodicAbilities, `definitions.${id}.preparedStats.periodicAbilities`, 'definition', id, 'periodicAbility', allDefIds, catalog, definitions)
      validateSpawnPayloadItems(def.preparedStats.triggerEffects, `definitions.${id}.preparedStats.triggerEffects`, 'definition', id, 'triggerEffect', allDefIds, catalog, definitions)
    }
    const spawner = def.preparedStats?.spawnerConfig ?? (base as { spawnerConfig?: { unitType?: string } } | undefined)?.spawnerConfig
    if (spawner?.unitType) {
      if (!allDefIds.has(spawner.unitType)) {
        throw new CombatDefinitionError(
          'MISSING_SPAWN_DEFINITION',
          `definition '${id}' spawnerConfig spawns unknown definition '${spawner.unitType}'`,
          { path: `definitions.${id}.preparedStats.spawnerConfig.unitType`, reference: spawner.unitType, definitionId: id },
        )
      }
      validateLateSpawnConfig(spawner.unitType, undefined, `definitions.${id}.preparedStats.spawnerConfig`, catalog, definitions)
    }
  }
}

function validateAbilityListSpawns(
  ownerType: 'definition' | 'unit',
  ownerId: string,
  basePath: string,
  abilities: unknown[] | undefined,
  allDefIds: Set<string>,
  catalog?: CombatCatalog,
  definitions?: Record<string, UnitDefinition>,
): void {
  if (!Array.isArray(abilities)) return
  for (let i = 0; i < abilities.length; i++) {
    const ab = abilities[i] as AbilityDefinition | undefined
    if (!ab || typeof ab !== 'object' || !Array.isArray(ab.effects)) continue
    for (let g = 0; g < ab.effects.length; g++) {
      const grp = ab.effects[g]
      if (!grp || typeof grp !== 'object' || !Array.isArray(grp.effects)) continue
      for (let e = 0; e < grp.effects.length; e++) {
        const eff = grp.effects[e]
        if (eff && typeof eff === 'object' && eff.kind === 'periodic_payload') {
          const payload = eff.ability?.payload
          if (payload && typeof payload === 'object' && payload.kind === 'spawn') {
            const p = payload as { unitType?: string; hpPercent?: number }
            if (!p.unitType || !allDefIds.has(p.unitType)) {
              throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `${ownerType} '${ownerId}' ability '${ab.id ?? i}' spawns unknown definition '${p.unitType ?? ''}'`,
                { path: `${basePath}[${i}].effects[${g}].effects[${e}].payload.unitType`, reference: p.unitType, definitionId: ownerId })
            }
            validateLateSpawnConfig(p.unitType, p.hpPercent, `${basePath}[${i}].effects[${g}].effects[${e}].payload`, catalog, definitions)
          }
        }
      }
    }
  }
}

export function validateUnitSpawnPayloads(
  unitIndex: number,
  unit: import('./contracts/index.js').UnitSpawnSpec,
  primitives: import('./combat.types.js').UnitBaseStats,
  allDefIds?: Set<string>,
  catalog?: CombatCatalog,
  definitions?: Record<string, UnitDefinition>,
): void {
  if (!allDefIds) return
  validateSpawnPayloadItems(
    primitives.periodicAbilities,
    `units[${unitIndex}].loadout.periodicAbilities`,
    'unit',
    unit.instanceId,
    'periodicAbility',
    allDefIds,
    catalog,
    definitions,
  )
  validateSpawnPayloadItems(
    primitives.triggerEffects,
    `units[${unitIndex}].loadout.triggerEffects`,
    'unit',
    unit.instanceId,
    'triggerEffect',
    allDefIds,
    catalog,
    definitions,
  )
  if (primitives.spawnerConfig) {
    const sc = primitives.spawnerConfig as { unitType?: string; interval?: number; timer?: number }
    if (sc.unitType && !allDefIds.has(sc.unitType)) {
      throw new CombatDefinitionError(
        'MISSING_SPAWN_DEFINITION',
        `unit '${unit.instanceId}' spawnerConfig spawns unknown definition '${sc.unitType}'`,
        { path: `units[${unitIndex}].spawnerConfig.unitType`, reference: sc.unitType, definitionId: unit.definitionId },
      )
    }
    if (sc.unitType) {
      validateLateSpawnConfig(sc.unitType, undefined, `units[${unitIndex}].spawnerConfig`, catalog, definitions)
    }
  }
  validateAbilityListSpawns('unit', unit.instanceId, `units[${unitIndex}].loadout.abilities`, primitives.abilities, allDefIds, catalog, definitions)
}

/**
 * Detects unconstrained summon cycles where definitions spawn each other indefinitely without a spawnCap.
 */
export function validateSummonCycles(allDefs: Record<string, DefWithPayloads>): void {
  for (const startId of Object.keys(allDefs)) {
    const path: string[] = []
    const visitedSet = new Set<string>()
    let current: string | undefined = startId
    while (current) {
      if (visitedSet.has(current)) {
        const cycleStartIndex = path.indexOf(current)
        if (cycleStartIndex !== -1) {
          const hasNoCap = path.slice(cycleStartIndex).some(id => {
            const def = allDefs[id]
            const base = def?.baseStats as { attackType?: string; spawnCap?: number } | undefined
            return base?.attackType === 'spawn' && (base.spawnCap == null || base.spawnCap <= 0)
          })
          if (hasNoCap) {
            throw new CombatDefinitionError(
              'UNCONSTRAINED_SUMMON_CYCLE',
              `unconstrained summon cycle detected for definition '${current}' without spawnCap`,
              { path: `definitions.${current}.baseStats.spawnCap`, definitionId: current },
            )
          }
        }
        break
      }
      visitedSet.add(current)
      path.push(current)
      current = allDefs[current]?.baseStats?.spawnType
      if (!current || !allDefs[current]) break
    }
  }
}
