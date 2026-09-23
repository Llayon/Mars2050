import type { BattleInput, UnitSpawnSpec, ScheduledEffect, ArenaSpec, UnitDefinition } from '@mars2050/combat-core/contracts'
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
 * Clamps legacy row.hp_current to definition maxHp for Mars backward compatibility.
 */
export function mapUnitRowsToSpawnSpecs(
  rows: UnitRow[],
  team: 'attacker' | 'defender',
  definitions?: Record<string, UnitDefinition>,
): UnitSpawnSpec[] {
  const defs = definitions ?? buildMarsUnitDefinitions()
  return rows.map(row => {
    let currentHp: number | undefined = row.hp_current ?? undefined
    if (currentHp !== undefined && defs[row.unit_type]) {
      const maxHp = defs[row.unit_type].baseStats.hp
      if (currentHp > maxHp) {
        currentHp = maxHp
      }
    }
    return {
      instanceId: row.id!,
      definitionId: row.unit_type,
      team,
      placement: {
        x: row.grid_x != null ? Number(row.grid_x) : undefined,
        y: row.grid_y != null ? Number(row.grid_y) : undefined,
      },
      currentHp,
      rank: getUnitRank(row),
      upgradeIds: row.upgrade_path ? [...row.upgrade_path] : [],
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
  const arena: ArenaSpec = {
    width: options.arena?.width ?? FIELD_WIDTH,
    height: options.arena?.height ?? FIELD_HEIGHT,
    tileSize: options.arena?.tileSize ?? TILE_SIZE,
    obstacles,
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
    ...mapUnitRowsToSpawnSpecs(attackerUnits, 'attacker', definitions),
    ...mapUnitRowsToSpawnSpecs(defenderUnits, 'defender', definitions),
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
