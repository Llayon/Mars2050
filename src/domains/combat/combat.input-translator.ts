import type { BattleInput, UnitSpawnSpec, ScheduledEffect, ArenaSpec } from '@mars2050/combat-core/contracts'
import type { UnitRow } from './combat.types'
import type { Obstacle } from './combat.sim.types'
import type { BattleSimulationOptions } from './combat.metrics'
import { MAX_TICKS } from './combat.config'
import { GLOBAL_UPGRADES } from './combat.upgrades'
import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE, generateObstacles } from './combat.utils'
import { getUnitRank } from './combat.rank-scaling'
import { buildMarsUnitDefinitions } from './combat.unit-definitions'
export { buildMarsUnitDefinitions } from './combat.unit-definitions'


/**
 * Maps a list of UnitRow objects into UnitSpawnSpec list for combat-core.
 */
export function mapUnitRowsToSpawnSpecs(rows: UnitRow[], team: 'attacker' | 'defender'): UnitSpawnSpec[] {
  return rows.map(row => ({
    instanceId: row.id!,
    definitionId: row.unit_type,
    team,
    placement: {
      x: row.grid_x != null ? Number(row.grid_x) : undefined,
      y: row.grid_y != null ? Number(row.grid_y) : undefined,
    },
    currentHp: row.hp_current ?? undefined,
    rank: getUnitRank(row),
    upgradeIds: row.upgrade_path ? [...row.upgrade_path] : [],
  }))
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
  const timeoutPolicy = options.timeoutPolicy === 'defender_holds' ? 'defender_win' : (options.timeoutPolicy ?? 'draw')
  const defenseResolutionMode = options.defenseResolutionMode ?? 'v9_snapshot'

  const definitions = buildMarsUnitDefinitions()
  const units: UnitSpawnSpec[] = [
    ...mapUnitRowsToSpawnSpecs(attackerUnits, 'attacker'),
    ...mapUnitRowsToSpawnSpecs(defenderUnits, 'defender'),
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
  }
}
