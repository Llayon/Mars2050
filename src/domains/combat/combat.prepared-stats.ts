import type { PreparedStats, UnitDefinition, SupportAuraModifierContract, BurrowConfigContract } from '@mars2050/combat-core/contracts'
import { extractSupportAuras } from '@mars2050/combat-core'
import type { RankScalingConfig } from './combat.sim.types'
import { applyRankScaling } from './combat.rank-scaling'
import { buildMarsUnitDefinitions } from './combat.unit-definitions'
import { buildMarsUpgrades, type UpgradeConfig } from './combat.upgrades'
import { collectMarsPreparedPrimitives } from './combat.prepared-primitives'

export type MarsCatalogInput =
  | import('@mars2050/combat-core/combat.catalog.types').CombatCatalog
  | { upgrades?: Readonly<Record<string, { modifiers?: Partial<UpgradeConfig['modifiers']> | Record<string, unknown> }>> }

/**
 * Computes fully prepared runtime stats for a Mars unit within the Mars adapter domain.
 * Mars owns its rank scaling, upgrade modifier resolution, and unit conversions.
 */
export function buildMarsPreparedStats(
  unitType: string,
  rank: number = 1,
  upgradeIds: string[] = [],
  catalog?: MarsCatalogInput,
  definitions?: Record<string, UnitDefinition>,
): PreparedStats | undefined {
  const catalogUnitTypes = (catalog && 'unitTypes' in catalog && catalog.unitTypes)
    ? (catalog.unitTypes as unknown as Record<string, UnitDefinition>)
    : undefined
  const defaultDefs = definitions ?? buildMarsUnitDefinitions()
  const def = catalogUnitTypes?.[unitType] ?? defaultDefs[unitType]
  if (!def) return undefined

  const base = def.baseStats
  let hp = base.hp
  let attack = base.attack
  let defense = base.defense
  let speed = base.speed
  let range = base.range
  let cooldown = base.actionCooldownMax || 10
  let canTargetAir = base.canTargetAir || false
  let aoeRadius = base.aoeRadius
  let attackType = base.attackType || 'single'
  let shield = (base as { shield?: number }).shield ?? 0
  let isFlying = base.isFlying || false
  let appliesEmp = false
  let leavesPuddle = false
  const rawBaseSpawner = (base as Record<string, unknown>).spawnerConfig as { unitType: string; interval: number; timer?: number } | undefined
  let spawnerConfig: { unitType: string; interval: number; timer: number } | undefined = rawBaseSpawner
    ? { unitType: rawBaseSpawner.unitType, interval: rawBaseSpawner.interval, timer: rawBaseSpawner.timer ?? rawBaseSpawner.interval }
    : undefined
  let movingReduction = 0
  let onDeathPuddle: 'napalm' | 'acid' | 'emp' | undefined
  let multishot = 1
  let antiAirDamageMult = base.antiAirDamageMult ?? 1
  let replicateOnKill = false
  let resurrectOnce = false
  let stealthUntilAttack = false
  let executeThreshold = 0
  let lifestealMult = 0
  let groundDamageMult = (base as Record<string, unknown>).groundDamageMult as number | undefined ?? 1
  let shieldDamageMult = base.shieldDamageMult ?? 1
  let armorPierceRatio = base.armorPierceRatio ?? 0
  let summonCounterDamageMult = base.summonCounterDamageMult ?? 1
  let accuracyPenaltyResist = base.accuracyPenaltyResist ?? 0
  const rawBurrow = (base as Record<string, unknown>).burrowWhileMoving as BurrowConfigContract | undefined
  let burrowConfig: BurrowConfigContract | undefined = rawBurrow ? { ...rawBurrow } : undefined
  const upgrades = catalog?.upgrades ?? buildMarsUpgrades()
  const upgradeRecord = upgrades as Readonly<Record<string, { modifiers?: Partial<UpgradeConfig['modifiers']> }>>
  const primitives = collectMarsPreparedPrimitives(def.baseStats as Record<string, unknown>, upgradeIds, upgradeRecord)
  const effectiveRankScaling = (primitives.rankScaling as RankScalingConfig | undefined) ?? (base as Record<string, unknown>).rankScaling as RankScalingConfig | undefined

  for (const upgradeId of upgradeIds) {
    const modifiers = upgradeRecord[upgradeId]?.modifiers
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
      const interval = modifiers.periodicSpawn.interval
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
    if (modifiers.armorPierceRatio !== undefined) armorPierceRatio = Math.max(armorPierceRatio, modifiers.armorPierceRatio)
    if (modifiers.summonCounterDamageMult) summonCounterDamageMult *= modifiers.summonCounterDamageMult
    if (modifiers.accuracyPenaltyResist !== undefined) accuracyPenaltyResist = Math.max(accuracyPenaltyResist, modifiers.accuracyPenaltyResist)
    if (modifiers.damageReductionWhileMoving) movingReduction = modifiers.damageReductionWhileMoving
    if (modifiers.burrowWhileMoving) {
      burrowConfig = {
        ...(burrowConfig ?? { damageReduction: 0 }),
        ...modifiers.burrowWhileMoving,
      }
    }
    if (modifiers.multishot) multishot = modifiers.multishot
    if (modifiers.antiAirDamageMult) antiAirDamageMult = modifiers.antiAirDamageMult
    if (modifiers.grantAntiAir) canTargetAir = true
    if (modifiers.addAoE) {
      attackType = 'aoe'
      aoeRadius = (aoeRadius ?? 0) + modifiers.addAoE
    }
  }

  const ranked = applyRankScaling(
    { hp, attack, defense, range, cooldown },
    effectiveRankScaling,
    rank,
  )

  const authoredAuras = extractSupportAuras((def.abilities ?? def.baseStats.abilities) as import('@mars2050/combat-core/combat.ability.types').AbilityDefinition[] | undefined)
  const auras = [
    ...((def.baseStats.supportAuras as import('@mars2050/combat-core/combat.sim.types').SupportAura[] | undefined) ?? []),
    ...authoredAuras,
  ]
  for (const upgradeId of upgradeIds) {
    const extraAuras = (upgradeRecord[upgradeId]?.modifiers as { supportAuras?: import('@mars2050/combat-core/combat.sim.types').SupportAura[] } | undefined)?.supportAuras
    if (extraAuras && Array.isArray(extraAuras)) {
      for (const aura of extraAuras) auras.push({ ...aura })
    }
  }

  return {
    hp: ranked.hp,
    attack: ranked.attack,
    defense: ranked.defense,
    speed,
    range: ranked.range,
    actionCooldownMax: ranked.cooldown,
    shield,
    isFlying,
    canTargetAir,
    attackType,
    aoeRadius,
    size: (def.baseStats.size ?? 'M') as 'S' | 'M' | 'L' | 'XL',
    turnSpeed: def.baseStats.turnSpeed ?? 5,
    combatTags: (def.baseStats.combatTags as string[]) ?? [],
    statusOnHit: def.baseStats.statusOnHit,
    stationaryAlignment: def.baseStats.stationaryAlignment,
    formationAnchorMode: def.baseStats.formationAnchorMode,
    velocityDamping: def.baseStats.velocityDamping,
    projectileInterceptable: def.baseStats.projectileInterceptable,
    targetingProfile: def.baseStats.targetingProfile,
    healTargetTags: (def.baseStats.healTargetTags as string[] | undefined),
    minimumRange: def.baseStats.minimumRange,
    selfDestructOnAttack: def.baseStats.selfDestructOnAttack,
    spawnType: def.baseStats.spawnType,
    spawnCap: def.baseStats.spawnCap,
    appliesEmp,
    leavesPuddle,
    spawnerConfig,
    movingReduction,
    onDeathPuddle,
    multishot,
    antiAirDamageMult,
    replicateOnKill,
    resurrectOnce,
    stealthUntilAttack,
    executeThreshold,
    lifestealMult,
    groundDamageMult,
    shieldDamageMult,
    armorPierceRatio,
    summonCounterDamageMult,
    accuracyPenaltyResist,
    burrowConfig,
    ...primitives,
    rankScaling: effectiveRankScaling as unknown as Record<string, unknown> | undefined,
    supportAuras: auras.length > 0 ? (auras as unknown as SupportAuraModifierContract[]) : undefined,
  }
}
