import { applyRankScaling } from './combat.rank-scaling.js'
import type { UnitBuildSpec } from './combat.unit-build.types.js'
import type { UnitBaseStats, UnitTypeConfig } from './combat.types.js'
import { getRuntimePrimitiveStats } from './combat.upgrade-primitives.js'
import { getDefaultCombatCatalog, type CombatCatalog } from './combat.catalog.types.js'
import type { UnitDefinition } from './contracts/index.js'
import { mapDefinitionToUnitTypeConfig } from './combat.definition-mapper.js'
import { resolveEffectiveUnitBaseStats } from './combat.effective-loadout.js'

export interface CompiledUnitStats {
  definition: UnitTypeConfig
  primitives: UnitBaseStats
  rank: number
  hp: number
  attack: number
  defense: number
  speed: number
  range: number
  cooldown: number
  canTargetAir: boolean
  attackType: UnitBaseStats['attackType']
  aoeRadius?: number
  shield: number
  isFlying: boolean
  appliesEmp: boolean
  leavesPuddle: boolean
  spawnerConfig?: { unitType: string; interval: number; timer: number }
  movingReduction: number
  onDeathPuddle?: 'napalm' | 'acid' | 'emp'
  multishot: number
  antiAirDamageMult: number
  replicateOnKill: boolean
  resurrectOnce: boolean
  stealthUntilAttack: boolean
  executeThreshold: number
  lifestealMult: number
  groundDamageMult: number
  shieldDamageMult: number
  armorPierceRatio: number
  summonCounterDamageMult: number
  accuracyPenaltyResist: number
  burrowConfig?: UnitBaseStats['burrowWhileMoving']
}

export function compileUnitStats(spec: UnitBuildSpec): CompiledUnitStats | null {
  const activeCatalog = spec.catalog ?? getDefaultCombatCatalog()
  const unitCatalog: Readonly<Record<string, UnitTypeConfig>> = activeCatalog?.unitTypes ?? {}
  const upgradesCatalog = activeCatalog?.upgrades ?? {}
  const definition = unitCatalog[spec.definitionId]
  if (!definition) return null
  const upgradeIds = resolveUnitUpgradeIds(spec)
  const isDefaultLoadout = upgradeIds.length === 0 && resolveRank(spec) === 1
  const p = spec.preparedStats ?? (isDefaultLoadout ? definition.preparedStats : undefined)
  const defPrep = definition.preparedStats
  const base = resolveEffectiveUnitBaseStats(resolveEffectiveUnitBaseStats(definition.baseStats, defPrep), spec.preparedStats)
  const primitives = getRuntimePrimitiveStats(base, upgradeIds, upgradesCatalog, p)
  if (p) {
    return {
      definition, primitives, rank: resolveRank(spec),
      hp: p.hp ?? base.hp, attack: p.attack ?? base.attack, defense: p.defense ?? base.defense,
      speed: p.speed ?? base.speed, range: p.range ?? base.range,
      cooldown: p.actionCooldownMax ?? base.actionCooldownMax ?? 10,
      canTargetAir: p.canTargetAir ?? base.canTargetAir ?? false,
      attackType: p.attackType ?? base.attackType ?? 'single',
      aoeRadius: p.aoeRadius ?? base.aoeRadius, shield: (p as { shield?: number }).shield ?? 0,
      isFlying: p.isFlying ?? base.isFlying ?? false,
      appliesEmp: (p as { appliesEmp?: boolean }).appliesEmp ?? (base as Record<string, unknown>).appliesEmp === true,
      leavesPuddle: (p as { leavesPuddle?: boolean }).leavesPuddle ?? (base as Record<string, unknown>).leavesPuddle === true,
      spawnerConfig: (p as { spawnerConfig?: CompiledUnitStats['spawnerConfig'] }).spawnerConfig ?? (base as Record<string, unknown>).spawnerConfig as CompiledUnitStats['spawnerConfig'],
      movingReduction: (p as { movingReduction?: number }).movingReduction ?? (typeof (base as Record<string, unknown>).movingReduction === 'number' ? (base as Record<string, unknown>).movingReduction as number : 0),
      onDeathPuddle: (p as { onDeathPuddle?: CompiledUnitStats['onDeathPuddle'] }).onDeathPuddle ?? (base as Record<string, unknown>).onDeathPuddle as CompiledUnitStats['onDeathPuddle'],
      multishot: (p as { multishot?: number }).multishot ?? (typeof (base as Record<string, unknown>).multishot === 'number' ? (base as Record<string, unknown>).multishot as number : 1),
      antiAirDamageMult: p.antiAirDamageMult ?? base.antiAirDamageMult ?? 1,
      replicateOnKill: (p as { replicateOnKill?: boolean }).replicateOnKill ?? (base as Record<string, unknown>).replicateOnKill === true,
      resurrectOnce: (p as { resurrectOnce?: boolean }).resurrectOnce ?? (base as Record<string, unknown>).resurrectOnce === true,
      stealthUntilAttack: (p as { stealthUntilAttack?: boolean }).stealthUntilAttack ?? (base as Record<string, unknown>).stealthUntilAttack === true,
      executeThreshold: (p as { executeThreshold?: number }).executeThreshold ?? (typeof (base as Record<string, unknown>).executeThreshold === 'number' ? (base as Record<string, unknown>).executeThreshold as number : 0),
      lifestealMult: (p as { lifestealMult?: number }).lifestealMult ?? (typeof (base as Record<string, unknown>).lifestealMult === 'number' ? (base as Record<string, unknown>).lifestealMult as number : 0),
      groundDamageMult: (p as { groundDamageMult?: number }).groundDamageMult ?? (typeof (base as Record<string, unknown>).groundDamageMult === 'number' ? (base as Record<string, unknown>).groundDamageMult as number : 1),
      shieldDamageMult: p.shieldDamageMult ?? base.shieldDamageMult ?? 1,
      armorPierceRatio: p.armorPierceRatio ?? base.armorPierceRatio ?? 0,
      summonCounterDamageMult: p.summonCounterDamageMult ?? base.summonCounterDamageMult ?? 1,
      accuracyPenaltyResist: p.accuracyPenaltyResist ?? base.accuracyPenaltyResist ?? 0,
      burrowConfig: (p as { burrowConfig?: UnitBaseStats['burrowWhileMoving'] }).burrowConfig ?? (base.burrowWhileMoving ? { ...base.burrowWhileMoving } : undefined),
    }
  }
  let hp = base.hp, attack = base.attack, defense = base.defense, speed = base.speed, range = base.range
  let cooldown = base.actionCooldownMax || 10, canTargetAir = base.canTargetAir || false
  let aoeRadius = base.aoeRadius, attackType = base.attackType || 'single', shield = 0
  let isFlying = base.isFlying || false, appliesEmp = false, leavesPuddle = false
  let spawnerConfig: CompiledUnitStats['spawnerConfig'], movingReduction = 0
  let onDeathPuddle: CompiledUnitStats['onDeathPuddle']
  let multishot = 1, antiAirDamageMult = base.antiAirDamageMult ?? 1
  let replicateOnKill = false, resurrectOnce = false, stealthUntilAttack = false
  let executeThreshold = 0, lifestealMult = 0, groundDamageMult = 1
  let shieldDamageMult = base.shieldDamageMult ?? 1, armorPierceRatio = base.armorPierceRatio ?? 0
  let summonCounterDamageMult = base.summonCounterDamageMult ?? 1, accuracyPenaltyResist = base.accuracyPenaltyResist ?? 0
  let burrowConfig = base.burrowWhileMoving ? { ...base.burrowWhileMoving } : undefined

  for (const upgradeId of upgradeIds) {
    const modifiers = upgradesCatalog[upgradeId]?.modifiers
    if (!modifiers) continue
    if (modifiers.hpMult) hp *= modifiers.hpMult
    if (modifiers.attackMult) attack *= modifiers.attackMult
    if (modifiers.defenseAdd) defense += modifiers.defenseAdd
    if (modifiers.speedMult) speed *= modifiers.speedMult
    if (modifiers.rangeAdd) range += modifiers.rangeAdd
    if (modifiers.cooldownMult) cooldown *= modifiers.cooldownMult
    if (modifiers.addFlying) isFlying = true
    if (modifiers.grantShield) shield += base.hp * modifiers.grantShield
    if (modifiers.grantShieldFlat) shield += modifiers.grantShieldFlat
    if (modifiers.disableEnemyTech) appliesEmp = true
    if (modifiers.leaveAoePuddle) leavesPuddle = true
    if (modifiers.periodicSpawn) {
      const interval = modifiers.periodicSpawn.interval * 10
      spawnerConfig = { unitType: modifiers.periodicSpawn.unit, interval, timer: interval }
    }
    if (modifiers.onDeathPuddle) onDeathPuddle = modifiers.onDeathPuddle
    if (modifiers.replicateOnKill) replicateOnKill = true
    if (modifiers.resurrectOnce) resurrectOnce = true
    if (modifiers.stealthUntilAttack) stealthUntilAttack = true
    if (modifiers.executeThreshold) executeThreshold = modifiers.executeThreshold
    if (modifiers.lifestealMult) lifestealMult = modifiers.lifestealMult
    if (modifiers.groundDamageMult) groundDamageMult = modifiers.groundDamageMult
    if (modifiers.shieldDamageMult) shieldDamageMult *= modifiers.shieldDamageMult
    if (modifiers.armorPierceRatio !== undefined) {
      armorPierceRatio = Math.max(armorPierceRatio, modifiers.armorPierceRatio)
    }
    if (modifiers.summonCounterDamageMult) {
      summonCounterDamageMult *= modifiers.summonCounterDamageMult
    }
    if (modifiers.accuracyPenaltyResist !== undefined) {
      accuracyPenaltyResist = Math.max(accuracyPenaltyResist, modifiers.accuracyPenaltyResist)
    }
    if (modifiers.damageReductionWhileMoving) movingReduction = modifiers.damageReductionWhileMoving
    if (modifiers.burrowWhileMoving) {
      burrowConfig = { ...modifiers.burrowWhileMoving }
    }
    if (modifiers.multishot) multishot = modifiers.multishot
    if (modifiers.antiAirDamageMult) antiAirDamageMult = modifiers.antiAirDamageMult
    if (modifiers.grantAntiAir) canTargetAir = true
    if (modifiers.addAoE) {
      attackType = 'aoe'
      aoeRadius = (aoeRadius ?? 0) + modifiers.addAoE
    }
  }

  const rank = resolveRank(spec)
  const ranked = applyRankScaling(
    { hp, attack, defense, range, cooldown },
    primitives.rankScaling,
    rank,
  )
  return {
    definition, primitives, rank,
    hp: ranked.hp, attack: ranked.attack, defense: ranked.defense,
    speed, range: ranked.range, cooldown: ranked.cooldown,
    canTargetAir, attackType, aoeRadius, shield, isFlying,
    appliesEmp, leavesPuddle, spawnerConfig, movingReduction, onDeathPuddle,
    multishot, antiAirDamageMult, replicateOnKill, resurrectOnce,
    stealthUntilAttack, executeThreshold, lifestealMult, groundDamageMult,
    shieldDamageMult, armorPierceRatio, summonCounterDamageMult,
    accuracyPenaltyResist, burrowConfig,
  }
}

export function resolveUnitUpgradeIds(spec: UnitBuildSpec): string[] {
  if (!spec.spawn || spec.spawn.inheritance === 'owner_loadout') {
    return [...spec.loadout.upgradeIds]
  }
  if (spec.spawn.inheritance === 'selected_upgrades') {
    return [...(spec.spawn.selectedUpgradeIds ?? [])]
  }
  return []
}

function resolveRank(spec: UnitBuildSpec): number {
  if (!spec.spawn || spec.spawn.inheritance === 'owner_rank' ||
      spec.spawn.inheritance === 'owner_loadout') {
    return spec.loadout.rank
  }
  return 1
}

/**
 * Calculates the compiled effective unit stats given its definition, rank, and upgrades.
 *
 * @param definitionId Unique identifier of the unit definition.
 * @param rank Rank level of the unit (defaults to 1).
 * @param upgradeIds List of upgrade IDs applied to the unit.
 * @param catalog Optional combat catalog containing unit types and upgrades.
 * @param definitions Optional scenario-specific unit definitions.
 * @returns Compiled unit stats or null if definition is not found.
 */
export function calculateEffectiveUnitStats(
  definitionId: string, rank: number = 1, upgradeIds: string[] = [],
  catalog?: CombatCatalog, definitions?: Record<string, UnitDefinition>,
  preparedStats?: import('./contracts/prepared.contracts.js').PreparedStats,
): CompiledUnitStats | null {
  const unitTypes: Record<string, UnitTypeConfig> = {}
  if (definitions) {
    for (const [key, def] of Object.entries(definitions)) {
      try { unitTypes[key] = mapDefinitionToUnitTypeConfig(def) } catch {}
    }
  }
  if (catalog?.unitTypes) {
    for (const [key, cfg] of Object.entries(catalog.unitTypes)) { unitTypes[key] = cfg }
  }
  const effectiveCatalog: CombatCatalog = {
    unitTypes, upgrades: catalog?.upgrades ?? {}, targetingProfiles: catalog?.targetingProfiles,
  }
  return compileUnitStats({
    definitionId, identity: { id: definitionId, team: 'attacker' },
    loadout: {
      rank: Number.isFinite(rank) ? Math.max(1, Math.floor(rank)) : 1,
      upgradeIds: Array.isArray(upgradeIds) ? [...upgradeIds] : [],
    },
    placement: { x: 0, y: 0, angle: 0 }, catalog: effectiveCatalog, preparedStats,
  })
}

/**
 * Calculates the effective maximum HP of a unit given its definition, rank, and upgrades.
 */
export function calculateEffectiveMaxHp(
  definitionId: string, rank: number = 1, upgradeIds: string[] = [],
  catalog?: CombatCatalog, definitions?: Record<string, UnitDefinition>,
  preparedStats?: import('./contracts/prepared.contracts.js').PreparedStats,
): number | undefined {
  const compiled = calculateEffectiveUnitStats(definitionId, rank, upgradeIds, catalog, definitions, preparedStats)
  return compiled ? compiled.hp : undefined
}
