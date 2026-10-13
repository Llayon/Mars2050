import type { BattleInput, UnitSpawnSpec, ScheduledEffect, ArenaSpec, UnitDefinition, PreparedStats, Obstacle } from '@mars2050/combat-core/contracts'
import { getFormationOffset, getSizeRadius } from '@mars2050/combat-core'
import type { UnitRow } from './combat.types'
import type { BattleSimulationOptions } from './combat.metrics'
import { MAX_TICKS, UNIT_TYPES } from './combat.config'
import { GLOBAL_UPGRADES, UPGRADES, buildMarsUpgrades, type UpgradeConfig } from './combat.upgrades'
import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE, generateObstacles } from './combat.utils'
import { getUnitRank } from './combat.rank-scaling'
import { buildMarsUnitDefinitions } from './combat.unit-definitions'
import { buildMarsPreparedStats, type MarsCatalogInput } from './combat.prepared-stats'
export { buildMarsUnitDefinitions } from './combat.unit-definitions'
export { buildMarsUpgrades } from './combat.upgrades'
export { buildMarsPreparedStats } from './combat.prepared-stats'

/**
 * Calculates effective max HP for a Mars unit using Mars adapter-owned preparation.
 */
export function calculateEffectiveMaxHp(
  unitType: string,
  rank: number = 1,
  upgradeIds: string[] = [],
  catalog?: MarsCatalogInput,
  definitions?: Record<string, UnitDefinition>,
): number | undefined {
  return buildMarsPreparedStats(unitType, rank, upgradeIds, catalog, definitions)?.hp
}

/**
 * Maps a list of UnitRow objects into UnitSpawnSpec list for combat-core.
 * Clamps legacy row.hp_current to effective maxHp (with rank & upgrades) for Mars backward compatibility.
 */
export function mapUnitRowsToSpawnSpecs(
  rows: UnitRow[],
  team: 'attacker' | 'defender',
  definitions?: Record<string, UnitDefinition>,
  arena?: ArenaSpec,
  catalog?: MarsCatalogInput,
): UnitSpawnSpec[] {
  const defs = definitions ?? buildMarsUnitDefinitions()
  const marsCatalog = catalog ?? { upgrades: buildMarsUpgrades() }
  const arenaWidth = arena?.width ?? FIELD_WIDTH
  const arenaHeight = arena?.height ?? FIELD_HEIGHT

  return rows.map(row => {
    const rank = getUnitRank(row)
    const upgradeIds = row.upgrade_path ? [...row.upgrade_path] : []
    const preparedStats = (row as { preparedStats?: PreparedStats }).preparedStats ??
      buildMarsPreparedStats(row.unit_type, rank, upgradeIds, marsCatalog, defs)
    let currentHp: number | undefined = row.hp_current ?? undefined
    if (currentHp !== undefined && preparedStats?.hp !== undefined) {
      if (currentHp > preparedStats.hp) {
        currentHp = preparedStats.hp
      }
    }

    const def = defs[row.unit_type]
    let posX = row.grid_x != null ? Number(row.grid_x) : undefined
    let posY = row.grid_y != null ? Number(row.grid_y) : undefined

    if (def) {
      const squadSize = Math.max(1, Math.floor(def.squadSize ?? 1))
      const spacing = def.squadSpacing ?? 20
      const rowSize = Math.ceil(Math.sqrt(squadSize))
      const formation = def.formation ?? 'grid'
      if (squadSize === 1) {
        const radius = getSizeRadius((preparedStats?.size ?? def.baseStats?.size ?? 'M') as 'S' | 'M' | 'L' | 'XL')
        if (posX != null) {
          posX = Math.max(radius, Math.min(arenaWidth - radius, posX))
        }
        if (posY != null) {
          posY = Math.max(radius, Math.min(arenaHeight - radius, posY))
        }
      } else {
        const offsets = Array.from({ length: squadSize }, (_, index) =>
          getFormationOffset(index, squadSize, rowSize, spacing, formation, team),
        )
        const minOffsetX = Math.min(...offsets.map(o => o.x))
        const maxOffsetX = Math.max(...offsets.map(o => o.x))
        const minOffsetY = Math.min(...offsets.map(o => o.y))
        const maxOffsetY = Math.max(...offsets.map(o => o.y))

        if (posX != null) {
          posX = Math.max(-minOffsetX, Math.min(arenaWidth - maxOffsetX, posX))
        }
        if (posY != null) {
          posY = Math.max(-minOffsetY, Math.min(arenaHeight - maxOffsetY, posY))
        }
      }
    }

    return {
      instanceId: row.id!,
      definitionId: row.unit_type,
      team,
      placement: {
        x: posX,
        y: posY,
      },
      currentHp,
      rank,
      upgradeIds,
      preparedStats,
    }
  })
}

/**
 * Maps Mars global upgrades into ScheduledEffect items for combat-core.
 */
export function mapGlobalUpgradesToScheduledEffects(
  attackerGlobals: string[] = [],
  defenderGlobals: string[] = [],
): ScheduledEffect[] {
  const effects: ScheduledEffect[] = []
  const mapGlobal = (id: string, team: 'attacker' | 'defender') => {
    const upg = GLOBAL_UPGRADES[id]
    if (!upg) return
    const tick = upg.type === 'global_emp' ? 50 : upg.type === 'orbital_strike' ? 100 : upg.type === 'mass_heal' ? 150 : 0
    effects.push({ id: upg.id, tick, team, type: upg.type, value: upg.value })
  }
  attackerGlobals.forEach(id => mapGlobal(id, 'attacker'))
  defenderGlobals.forEach(id => mapGlobal(id, 'defender'))
  return effects
}

/**
 * Translates simulateBattle parameters into BattleInput for simulateCombat.
 */
export function translateMarsBattleInput(
  attackerUnits: UnitRow[],
  defenderUnits: UnitRow[],
  providedSeed?: number,
  providedObstacles?: Obstacle[],
  attackerGlobals: string[] = [],
  defenderGlobals: string[] = [],
  options: BattleSimulationOptions = {},
): BattleInput {
  const seed = providedSeed ?? Date.now()
  const obstacles: Obstacle[] = options.arena?.obstacles ?? providedObstacles ?? generateObstacles(seed)
  const arenaWidth = options.arena?.width ?? FIELD_WIDTH
  const arenaHeight = options.arena?.height ?? FIELD_HEIGHT
  const deployment = options.arena?.deployment
    ? { strategy: options.arena.deployment.strategy ?? ('center' as const), ...options.arena.deployment }
    : (arenaHeight >= 640 ? { depth: 320, strategy: 'center' as const } : { strategy: 'center' as const })
  const arena: ArenaSpec = {
    width: arenaWidth,
    height: arenaHeight,
    tileSize: options.arena?.tileSize ?? TILE_SIZE,
    obstacles,
    deployment,
  }
  const maxTicks = options.maxTicks !== undefined && Number.isFinite(options.maxTicks)
    ? Math.max(1, Math.min(2000, Math.floor(options.maxTicks))) : MAX_TICKS
  const timeoutPolicy = (options.timeoutPolicy === 'attacker_holds' || options.timeoutPolicy === 'attacker_win')
    ? 'attacker_win'
    : (options.timeoutPolicy === 'defender_holds' || options.timeoutPolicy === 'defender_win')
      ? 'defender_win'
      : 'draw'
  const defenseResolutionMode = options.defenseResolutionMode ?? 'v9_snapshot'

  const rawDefs: Record<string, UnitDefinition> = {
    ...buildMarsUnitDefinitions(),
    ...(options.definitions ?? {}),
    ...(options.catalog?.unitTypes
      ? Object.fromEntries(
          Object.entries(options.catalog.unitTypes).map(([k, v]) => {
            const raw = v as unknown as Record<string, unknown>
            return [
              k,
              {
                ...raw,
                id: (raw.id as string | undefined) ?? k,
                name: (raw.name as string | undefined) ?? k,
                baseStats: raw.baseStats,
              } as unknown as UnitDefinition,
            ]
          }),
        )
      : {}),
  }
  const marsCatalog = {
    upgrades: {
      ...buildMarsUpgrades(),
      ...(options.catalog?.upgrades ?? {}),
    },
  }
  const definitions: Record<string, UnitDefinition> = {}
  for (const [k, d] of Object.entries(rawDefs)) {
    definitions[k] = { ...d, preparedStats: buildMarsPreparedStats(k, 1, [], marsCatalog, rawDefs) }
  }
  const units: UnitSpawnSpec[] = [
    ...mapUnitRowsToSpawnSpecs(attackerUnits, 'attacker', rawDefs, arena, marsCatalog),
    ...mapUnitRowsToSpawnSpecs(defenderUnits, 'defender', rawDefs, arena, marsCatalog),
  ]
  const scheduledEffects = mapGlobalUpgradesToScheduledEffects(attackerGlobals, defenderGlobals)

  return {
    seed,
    arena,
    rules: { maxTicks, timeoutPolicy, defenseResolutionMode, trackMetrics: options.trackMetrics, profile: options.profile },
    definitions,
    units,
    scheduledEffects,
    catalog: {
      upgrades: marsCatalog.upgrades as unknown as NonNullable<BattleInput['catalog']>['upgrades'],
      unitTypes: definitions,
    },
  }
}
