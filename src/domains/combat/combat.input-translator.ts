import type { BattleInput, UnitSpawnSpec, ScheduledEffect, ArenaSpec, UnitDefinition } from '@mars2050/combat-core/contracts'
import { calculateEffectiveMaxHp, getFormationOffset, getSizeRadius } from '@mars2050/combat-core'
import type { UnitRow } from './combat.types'
import type { Obstacle } from './combat.sim.types'
import type { BattleSimulationOptions } from './combat.metrics'
import { MAX_TICKS, UNIT_TYPES } from './combat.config'
import { GLOBAL_UPGRADES, UPGRADES } from './combat.upgrades'
import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE, generateObstacles } from './combat.utils'
import { getUnitRank } from './combat.rank-scaling'
import { buildMarsUnitDefinitions } from './combat.unit-definitions'
export { buildMarsUnitDefinitions } from './combat.unit-definitions'


/**
 * Maps a list of UnitRow objects into UnitSpawnSpec list for combat-core.
 * Clamps legacy row.hp_current to effective maxHp (with rank & upgrades) for Mars backward compatibility.
 */
export function mapUnitRowsToSpawnSpecs(
  rows: UnitRow[],
  team: 'attacker' | 'defender',
  definitions?: Record<string, UnitDefinition>,
  arena?: ArenaSpec,
): UnitSpawnSpec[] {
  const defs = definitions ?? buildMarsUnitDefinitions()
  const marsCatalog = { unitTypes: UNIT_TYPES, upgrades: UPGRADES }
  const arenaWidth = arena?.width ?? FIELD_WIDTH
  const arenaHeight = arena?.height ?? FIELD_HEIGHT

  return rows.map(row => {
    const rank = getUnitRank(row)
    const upgradeIds = row.upgrade_path ? [...row.upgrade_path] : []
    let currentHp: number | undefined = row.hp_current ?? undefined
    if (currentHp !== undefined) {
      const maxHp = calculateEffectiveMaxHp(row.unit_type, rank, upgradeIds, marsCatalog, defs)
      if (maxHp !== undefined && currentHp > maxHp) {
        currentHp = maxHp
      }
    }

    const def = defs[row.unit_type] ?? marsCatalog.unitTypes[row.unit_type]
    let posX = row.grid_x != null ? Number(row.grid_x) : undefined
    let posY = row.grid_y != null ? Number(row.grid_y) : undefined

    if (def) {
      const squadSize = Math.max(1, Math.floor(def.squadSize ?? 1))
      const spacing = def.squadSpacing ?? 20
      const rowSize = Math.ceil(Math.sqrt(squadSize))
      const formation = def.formation ?? 'grid'
      if (squadSize === 1) {
        const radius = getSizeRadius((def.baseStats?.size ?? 'M') as 'S' | 'M' | 'L' | 'XL')
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
    ? Math.max(1, Math.min(2000, Math.floor(options.maxTicks)))
    : MAX_TICKS
  const timeoutPolicy = options.timeoutPolicy === 'attacker_holds'
    ? 'attacker_win'
    : options.timeoutPolicy === 'defender_holds'
      ? 'defender_win'
      : 'draw'
  const defenseResolutionMode = options.defenseResolutionMode ?? 'v9_snapshot'

  const definitions = buildMarsUnitDefinitions()
  const units: UnitSpawnSpec[] = [
    ...mapUnitRowsToSpawnSpecs(attackerUnits, 'attacker', definitions, arena),
    ...mapUnitRowsToSpawnSpecs(defenderUnits, 'defender', definitions, arena),
  ]
  const scheduledEffects = mapGlobalUpgradesToScheduledEffects(attackerGlobals, defenderGlobals)

  return {
    seed,
    arena,
    rules: {
      maxTicks,
      timeoutPolicy,
      defenseResolutionMode,
      trackMetrics: options.trackMetrics,
      profile: options.profile,
    },
    definitions,
    units,
    scheduledEffects,
    catalog: {
      unitTypes: UNIT_TYPES,
      upgrades: UPGRADES,
    },
  }
}
