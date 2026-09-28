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
  baseStats?: {
    spawnType?: string
    spawnOverrides?: { hp?: number; attack?: number; duration?: number }
    periodicAbilities?: unknown[]
    triggerEffects?: TriggerEffectConfig[]
    abilities?: unknown[]
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
      if (Array.isArray(mods.periodicAbilities)) {
        for (let i = 0; i < mods.periodicAbilities.length; i++) {
          const a = mods.periodicAbilities[i]
          if (a?.payload && typeof a.payload === 'object' && a.payload.kind === 'spawn') {
            const p = a.payload as { unitType?: string; hpPercent?: number }
            if (!p.unitType || !allDefIds.has(p.unitType)) {
              throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `upgrade '${upgId}' periodicAbility '${a.id ?? i}' spawns unknown definition '${p.unitType ?? ''}'`,
                { path: `catalog.upgrades.${upgId}.modifiers.periodicAbilities[${i}].payload.unitType`, reference: p.unitType, definitionId: upgId })
            }
            validateLateSpawnConfig(p.unitType, p.hpPercent, `catalog.upgrades.${upgId}.modifiers.periodicAbilities[${i}].payload`, catalog, definitions)
          }
        }
      }
      if (Array.isArray(mods.triggerEffects)) {
        for (let i = 0; i < mods.triggerEffects.length; i++) {
          const t = mods.triggerEffects[i]
          if (t?.payload && typeof t.payload === 'object' && t.payload.kind === 'spawn') {
            const p = t.payload as { unitType?: string; hpPercent?: number }
            if (!p.unitType || !allDefIds.has(p.unitType)) {
              throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `upgrade '${upgId}' triggerEffect '${t.id ?? i}' spawns unknown definition '${p.unitType ?? ''}'`,
                { path: `catalog.upgrades.${upgId}.modifiers.triggerEffects[${i}].payload.unitType`, reference: p.unitType, definitionId: upgId })
            }
            validateLateSpawnConfig(p.unitType, p.hpPercent, `catalog.upgrades.${upgId}.modifiers.triggerEffects[${i}].payload`, catalog, definitions)
          }
        }
      }
    }
  }

  for (const [id, def] of Object.entries(allDefs)) {
    if (!def || typeof def !== 'object') continue
    const base = def.baseStats
    if (base && typeof base === 'object') {
      if (base.spawnType) {
        if (!allDefIds.has(base.spawnType)) {
          throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `definition '${id}' spawns unknown definition '${base.spawnType}'`,
            { path: `definitions.${id}.baseStats.spawnType`, reference: base.spawnType, definitionId: id })
        }
        validateLateSpawnConfig(base.spawnType, undefined, `definitions.${id}.baseStats.spawnType`, catalog, definitions, base.spawnOverrides)
      }
      if (Array.isArray(base.periodicAbilities)) {
        for (let i = 0; i < base.periodicAbilities.length; i++) {
          const a = base.periodicAbilities[i] as PeriodicAbilityConfig | undefined
          if (a?.payload && typeof a.payload === 'object' && a.payload.kind === 'spawn') {
            const p = a.payload as { unitType?: string; hpPercent?: number }
            if (!p.unitType || !allDefIds.has(p.unitType)) {
              throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `definition '${id}' periodicAbility '${a.id ?? i}' spawns unknown definition '${p.unitType ?? ''}'`,
                { path: `definitions.${id}.baseStats.periodicAbilities[${i}].payload.unitType`, reference: p.unitType, definitionId: id })
            }
            validateLateSpawnConfig(p.unitType, p.hpPercent, `definitions.${id}.baseStats.periodicAbilities[${i}].payload`, catalog, definitions)
          }
        }
      }
      if (Array.isArray(base.triggerEffects)) {
        for (let i = 0; i < base.triggerEffects.length; i++) {
          const t = base.triggerEffects[i]
          if (t?.payload && typeof t.payload === 'object' && t.payload.kind === 'spawn') {
            const p = t.payload as { unitType?: string; hpPercent?: number }
            if (!p.unitType || !allDefIds.has(p.unitType)) {
              throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `definition '${id}' triggerEffect '${t.id ?? i}' spawns unknown definition '${p.unitType ?? ''}'`,
                { path: `definitions.${id}.baseStats.triggerEffects[${i}].payload.unitType`, reference: p.unitType, definitionId: id })
            }
            validateLateSpawnConfig(p.unitType, p.hpPercent, `definitions.${id}.baseStats.triggerEffects[${i}].payload`, catalog, definitions)
          }
        }
      }
      validateAbilityListSpawns(id, `definitions.${id}.baseStats.abilities`, base.abilities, allDefIds, catalog, definitions)
    }
    if (Array.isArray(def.periodicAbilities)) {
      for (let i = 0; i < def.periodicAbilities.length; i++) {
        const a = def.periodicAbilities[i] as PeriodicAbilityConfig | undefined
        if (a?.payload && typeof a.payload === 'object' && a.payload.kind === 'spawn') {
          const p = a.payload as { unitType?: string; hpPercent?: number }
          if (!p.unitType || !allDefIds.has(p.unitType)) {
            throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `definition '${id}' periodicAbility '${a.id ?? i}' spawns unknown definition '${p.unitType ?? ''}'`,
              { path: `definitions.${id}.periodicAbilities[${i}].payload.unitType`, reference: p.unitType, definitionId: id })
          }
          validateLateSpawnConfig(p.unitType, p.hpPercent, `definitions.${id}.periodicAbilities[${i}].payload`, catalog, definitions)
        }
      }
    }
    validateAbilityListSpawns(id, `definitions.${id}.abilities`, def.abilities, allDefIds, catalog, definitions)
  }
}

function validateAbilityListSpawns(
  defId: string,
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
              throw new CombatDefinitionError('MISSING_SPAWN_DEFINITION', `definition '${defId}' ability '${ab.id ?? i}' spawns unknown definition '${p.unitType ?? ''}'`,
                { path: `${basePath}[${i}].effects[${g}].effects[${e}].payload.unitType`, reference: p.unitType, definitionId: defId })
            }
            validateLateSpawnConfig(p.unitType, p.hpPercent, `${basePath}[${i}].effects[${g}].effects[${e}].payload`, catalog, definitions)
          }
        }
      }
    }
  }
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
