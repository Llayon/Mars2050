import type { BattleInput, UnitSpawnSpec, ScheduledEffect, ArenaSpec, UnitDefinition, PreparedStats } from '@mars2050/combat-core/contracts'
import { calculateEffectiveUnitStats, calculateEffectiveMaxHp, getFormationOffset, getSizeRadius, getUnitSupportAuras, extractSupportAuras } from '@mars2050/combat-core'
import type { UnitRow } from './combat.types'
import type { Obstacle } from './combat.sim.types'
import type { BattleSimulationOptions } from './combat.metrics'
import { MAX_TICKS, UNIT_TYPES } from './combat.config'
import { GLOBAL_UPGRADES, UPGRADES, buildMarsUpgrades, type UpgradeConfig } from './combat.upgrades'
import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE, generateObstacles } from './combat.utils'
import { getUnitRank } from './combat.rank-scaling'
import { buildMarsUnitDefinitions } from './combat.unit-definitions'
export { buildMarsUnitDefinitions } from './combat.unit-definitions'
export { buildMarsUpgrades } from './combat.upgrades'

/**
 * Compiles fully prepared runtime stats for a Mars unit.
 */
export function buildMarsPreparedStats(
  unitType: string,
  rank: number = 1,
  upgradeIds: string[] = [],
  catalog?: import('@mars2050/combat-core/combat.catalog.types').CombatCatalog | { upgrades?: Record<string, UpgradeConfig> },
  definitions?: Record<string, UnitDefinition>,
): PreparedStats | undefined {
  const defs = definitions ?? buildMarsUnitDefinitions()
  const marsCatalog = (catalog as import('@mars2050/combat-core/combat.catalog.types').CombatCatalog | undefined) ?? { upgrades: buildMarsUpgrades() }
  const effective = calculateEffectiveUnitStats(unitType, rank, upgradeIds, marsCatalog, defs)
  if (!effective) return undefined
  const def = defs[unitType]
  const authoredAuras = extractSupportAuras((def?.abilities ?? def?.baseStats?.abilities) as import('@mars2050/combat-core/combat.ability.types').AbilityDefinition[] | undefined)
  const baseAuras = [
    ...((def?.baseStats?.supportAuras as import('@mars2050/combat-core/combat.sim.types').SupportAura[] | undefined) ?? []),
    ...authoredAuras,
  ]
  const supportAuras = getUnitSupportAuras(
    baseAuras.length > 0 ? baseAuras : undefined,
    upgradeIds,
    marsCatalog.upgrades as Record<string, import('@mars2050/combat-core/combat.catalog.types').UpgradeConfig>,
  )
  return {
    hp: effective.hp,
    attack: effective.attack,
    defense: effective.defense,
    speed: effective.speed,
    range: effective.range,
    actionCooldownMax: effective.cooldown,
    shield: effective.shield,
    isFlying: effective.isFlying,
    canTargetAir: effective.canTargetAir,
    attackType: effective.attackType,
    aoeRadius: effective.aoeRadius,
    size: (effective.primitives?.size ?? def?.baseStats?.size ?? 'M') as 'S' | 'M' | 'L' | 'XL',
    turnSpeed: effective.primitives?.turnSpeed ?? def?.baseStats?.turnSpeed ?? 5,
    combatTags: effective.primitives?.combatTags ?? def?.baseStats?.combatTags ?? [],
    statusOnHit: effective.primitives?.statusOnHit ?? def?.baseStats?.statusOnHit,
    stationaryAlignment: effective.primitives?.stationaryAlignment ?? def?.baseStats?.stationaryAlignment,
    formationAnchorMode: effective.primitives?.formationAnchorMode ?? def?.baseStats?.formationAnchorMode,
    velocityDamping: effective.primitives?.velocityDamping ?? def?.baseStats?.velocityDamping,
    projectileInterceptable: effective.primitives?.projectileInterceptable ?? def?.baseStats?.projectileInterceptable,
    targetingProfile: effective.primitives?.targetingProfile ?? def?.baseStats?.targetingProfile,
    healTargetTags: effective.primitives?.healTargetTags ?? def?.baseStats?.healTargetTags,
    minimumRange: effective.primitives?.minimumRange ?? def?.baseStats?.minimumRange,
    selfDestructOnAttack: effective.primitives?.selfDestructOnAttack ?? def?.baseStats?.selfDestructOnAttack,
    spawnType: effective.primitives?.spawnType ?? def?.baseStats?.spawnType,
    spawnCap: effective.primitives?.spawnCap ?? def?.baseStats?.spawnCap,
    appliesEmp: effective.appliesEmp,
    leavesPuddle: effective.leavesPuddle,
    spawnerConfig: effective.spawnerConfig,
    movingReduction: effective.movingReduction,
    onDeathPuddle: effective.onDeathPuddle,
    multishot: effective.multishot,
    antiAirDamageMult: effective.antiAirDamageMult,
    replicateOnKill: effective.replicateOnKill,
    resurrectOnce: effective.resurrectOnce,
    stealthUntilAttack: effective.stealthUntilAttack,
    executeThreshold: effective.executeThreshold,
    lifestealMult: effective.lifestealMult,
    groundDamageMult: effective.groundDamageMult,
    shieldDamageMult: effective.shieldDamageMult,
    armorPierceRatio: effective.armorPierceRatio,
    summonCounterDamageMult: effective.summonCounterDamageMult,
    accuracyPenaltyResist: effective.accuracyPenaltyResist,
    burrowConfig: effective.burrowConfig,
    supportAuras: supportAuras ? (supportAuras as unknown as import('@mars2050/combat-core/contracts').SupportAuraModifierContract[]) : undefined,
    periodicAbilities: effective.primitives?.periodicAbilities ? (effective.primitives.periodicAbilities as unknown as Record<string, unknown>[]) : (def?.baseStats?.periodicAbilities ? (def.baseStats.periodicAbilities as unknown as Record<string, unknown>[]) : undefined),
    triggerEffects: effective.primitives?.triggerEffects ? (effective.primitives.triggerEffects as unknown as Record<string, unknown>[]) : (def?.baseStats?.triggerEffects ? (def.baseStats.triggerEffects as unknown as Record<string, unknown>[]) : undefined),
  }
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
): UnitSpawnSpec[] {
  const defs = definitions ?? buildMarsUnitDefinitions()
  const marsCatalog = { upgrades: buildMarsUpgrades() }
  const arenaWidth = arena?.width ?? FIELD_WIDTH
  const arenaHeight = arena?.height ?? FIELD_HEIGHT

  return rows.map(row => {
    const rank = getUnitRank(row)
    const upgradeIds = row.upgrade_path ? [...row.upgrade_path] : []
    const preparedStats = buildMarsPreparedStats(row.unit_type, rank, upgradeIds, marsCatalog, defs)
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
  const timeoutPolicy = options.timeoutPolicy === 'attacker_holds' ? 'attacker_win'
    : options.timeoutPolicy === 'defender_holds' ? 'defender_win' : 'draw'
  const defenseResolutionMode = options.defenseResolutionMode ?? 'v9_snapshot'

  const rawDefs = buildMarsUnitDefinitions()
  const marsCatalog = { upgrades: buildMarsUpgrades() }
  const definitions: Record<string, UnitDefinition> = {}
  for (const [k, d] of Object.entries(rawDefs)) {
    definitions[k] = { ...d, preparedStats: buildMarsPreparedStats(k, 1, [], marsCatalog, rawDefs) }
  }
  const units: UnitSpawnSpec[] = [
    ...mapUnitRowsToSpawnSpecs(attackerUnits, 'attacker', rawDefs, arena),
    ...mapUnitRowsToSpawnSpecs(defenderUnits, 'defender', rawDefs, arena),
  ]
  const scheduledEffects = mapGlobalUpgradesToScheduledEffects(attackerGlobals, defenderGlobals)

  return {
    seed,
    arena,
    rules: { maxTicks, timeoutPolicy, defenseResolutionMode, trackMetrics: options.trackMetrics, profile: options.profile },
    definitions,
    units,
    scheduledEffects,
    catalog: { upgrades: marsCatalog.upgrades, unitTypes: definitions },
  }
}
