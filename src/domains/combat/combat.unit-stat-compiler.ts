import { UNIT_TYPES } from './combat.config'
import { applyRankScaling } from './combat.rank-scaling'
import type { UnitBuildSpec } from './combat.unit-build.types'
import type { UnitBaseStats, UnitTypeConfig } from './combat.types'
import { getRuntimePrimitiveStats } from './combat.upgrade-primitives'
import { UPGRADES } from './combat.upgrades'

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
  const definition = UNIT_TYPES[spec.definitionId]
  if (!definition) return null
  const upgradeIds = resolveUnitUpgradeIds(spec)
  const primitives = getRuntimePrimitiveStats(definition.baseStats, upgradeIds)
  const base = definition.baseStats
  let hp = base.hp
  let attack = base.attack
  let defense = base.defense
  let speed = base.speed * 15
  let range = base.range * 40
  let cooldown = base.actionCooldownMax || 10
  let canTargetAir = base.canTargetAir || false
  let aoeRadius = base.aoeRadius ? base.aoeRadius * 40 : undefined
  let attackType = base.attackType || 'single'
  let shield = 0
  let isFlying = base.isFlying || false
  let appliesEmp = false, leavesPuddle = false
  let spawnerConfig: CompiledUnitStats['spawnerConfig']
  let movingReduction = 0
  let onDeathPuddle: CompiledUnitStats['onDeathPuddle']
  let multishot = 1, antiAirDamageMult = base.antiAirDamageMult ?? 1
  let replicateOnKill = false, resurrectOnce = false, stealthUntilAttack = false
  let executeThreshold = 0, lifestealMult = 0, groundDamageMult = 1
  let shieldDamageMult = base.shieldDamageMult ?? 1
  let armorPierceRatio = base.armorPierceRatio ?? 0
  let summonCounterDamageMult = base.summonCounterDamageMult ?? 1
  let accuracyPenaltyResist = base.accuracyPenaltyResist ?? 0
  let burrowConfig = base.burrowWhileMoving
    ? { ...base.burrowWhileMoving }
    : undefined

  for (const upgradeId of upgradeIds) {
    const modifiers = UPGRADES[upgradeId]?.modifiers
    if (!modifiers) continue
    if (modifiers.hpMult) hp *= modifiers.hpMult
    if (modifiers.attackMult) attack *= modifiers.attackMult
    if (modifiers.defenseAdd) defense += modifiers.defenseAdd
    if (modifiers.speedMult) speed *= modifiers.speedMult
    if (modifiers.rangeAdd) range += modifiers.rangeAdd * 40
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
      aoeRadius = (aoeRadius ?? 0) + modifiers.addAoE * 40
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
