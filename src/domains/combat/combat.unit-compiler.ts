import { prepareRuntimePrimitives } from './combat.runtime-primitives'
import type { SimUnit } from './combat.sim.types'
import { getUnitSupportAuras } from './combat.support-aura-config'
import { DEFAULT_TARGETING_PROFILE } from './combat.targeting.config'
import type {
  UnitBuildSpec,
  UnitRuntimeRules,
} from './combat.unit-build.types'
import type { UnitBaseStats } from './combat.types'
import {
  compileUnitStats,
  resolveUnitUpgradeIds,
} from './combat.unit-stat-compiler'
import { assertValidWeaponLoadout } from './combat.weapon-validation'
import {
  captureUnitEntityBundle,
  type UnitEntityBundle,
} from './ecs/unit-entity-bundle'

export function compileUnit(spec: UnitBuildSpec): UnitEntityBundle | null {
  const snapshot = compileUnitSnapshot(spec)
  return snapshot ? captureUnitEntityBundle(snapshot) : null
}

export function compileUnitSnapshot(spec: UnitBuildSpec): SimUnit | null {
  const compiled = compileUnitStats(spec)
  if (!compiled) return null
  const { definition, primitives } = compiled
  assertValidWeaponLoadout(spec.definitionId, primitives)
  const compiledMaxHp = Math.max(1, spec.overrides?.maxHp ?? compiled.hp)
  const maxHpSource = spec.overrides?.hpPercent === undefined
    ? compiledMaxHp
    : Math.max(1, Math.floor(compiledMaxHp * spec.overrides.hpPercent))
  const currentHp = spec.overrides?.currentHp === undefined
    ? maxHpSource
    : Math.min(spec.overrides.currentHp, maxHpSource)
  const modeSwitchConfig = primitives.modeSwitch
    ? { ...primitives.modeSwitch }
    : undefined
  const isFlying = modeSwitchConfig
    ? (modeSwitchConfig.startMode ?? 'ground') === 'air'
    : compiled.isFlying
  const shield = Math.round(compiled.shield)
  const runtimeSpawn = spec.spawn !== undefined
  const unit: SimUnit = {
    id: spec.identity.id,
    team: spec.identity.team,
    type: spec.definitionId,
    rank: runtimeSpawn && compiled.rank === 1 ? undefined : compiled.rank,
    squadId: spec.identity.squadId,
    summonOwnerId: spec.identity.summonOwnerId,
    summonSourceId: spec.identity.summonSourceId,
    hp: currentHp,
    maxHp: Math.round(maxHpSource),
    attack: Math.round(spec.overrides?.attack ?? compiled.attack),
    defense: compiled.defense,
    speed: compiled.speed,
    range: compiled.range,
    attackType: compiled.attackType,
    aoeRadius: compiled.aoeRadius,
    selfDestructOnAttack: primitives.selfDestructOnAttack,
    spawnType: primitives.spawnType,
    spawnCap: primitives.spawnCap,
    actionCooldownMax: compiled.cooldown,
    actionCooldown: 0,
    isFlying,
    canTargetAir: compiled.canTargetAir,
    isTemporary: spec.overrides?.isTemporary,
    temporaryDuration: spec.overrides?.temporaryDuration,
    x: spec.placement.x,
    y: spec.placement.y,
    offsetX: spec.placement.offsetX,
    offsetY: spec.placement.offsetY,
    isDead: false,
    aggroLockTicks: 0,
    designatedSquadId: undefined,
    velocity: { x: 0, y: 0 },
    turnSpeed: runtimeSpawn
      ? (primitives.turnSpeed ?? 0.5)
      : (primitives.turnSpeed || 0.5),
    currentAngle: spec.placement.angle,
    initialAngle: spec.placement.angle,
    size: primitives.size || 'M',
    shield,
    maxShield: shield,
    statusEffects: [],
    statusOnHit: primitives.statusOnHit?.map(status => ({ ...status })),
    markOnHit: primitives.markOnHit ? { ...primitives.markOnHit } : undefined,
    supportAuras: getUnitSupportAuras(
      primitives.supportAuras,
      resolveUnitUpgradeIds(spec),
    ),
    groundDamageMult: compiled.groundDamageMult,
    shieldDamageMult: compiled.shieldDamageMult,
    armorPierceRatio: compiled.armorPierceRatio || undefined,
    summonCounterDamageMult: compiled.summonCounterDamageMult === 1
      ? undefined
      : compiled.summonCounterDamageMult,
    accuracyPenaltyResist: compiled.accuracyPenaltyResist || undefined,
    burrowConfig: compiled.burrowConfig
      ? { ...compiled.burrowConfig }
      : undefined,
    isBurrowed: false,
    modeSwitchConfig,
    mobilityMode: modeSwitchConfig
      ? (modeSwitchConfig.startMode ?? 'ground')
      : undefined,
    pullOnHit: primitives.pullOnHit ? {
      radius: primitives.pullOnHit.radius * 40,
      strength: primitives.pullOnHit.strength * 40,
      maxTargets: primitives.pullOnHit.maxTargets,
    } : undefined,
    knockbackOnHit: primitives.knockbackOnHit ? {
      radius: primitives.knockbackOnHit.radius * 40,
      strength: primitives.knockbackOnHit.strength * 40,
      maxTargets: primitives.knockbackOnHit.maxTargets,
    } : undefined,
    reactiveArmorCharges: primitives.reactiveArmor?.charges,
    reactiveArmorBlock: primitives.reactiveArmor?.block,
    damageShareRadius: primitives.damageShare?.radius
      ? primitives.damageShare.radius * 40
      : undefined,
    damageShareRatio: primitives.damageShare?.ratio,
    damageShareMaxTargets: primitives.damageShare?.maxTargets,
    projectileInterceptRadius: primitives.projectileInterception?.radius,
    projectileInterceptCooldownMax:
      primitives.projectileInterception?.cooldownTicks,
    projectileInterceptCooldown: 0,
    projectileInterceptMaxDamage:
      primitives.projectileInterception?.maxDamage,
    smokeOnAction: primitives.smokeOnAction
      ? { ...primitives.smokeOnAction }
      : undefined,
    stanceConfig: primitives.stance ? { ...primitives.stance } : undefined,
    stanceMode: primitives.stance ? 'mobile' : undefined,
    stanceTicks: 0,
    antiAirDamageMult: runtimeSpawn
      ? primitives.antiAirDamageMult
      : compiled.antiAirDamageMult,
    appliesEmp: runtimeSpawn && !compiled.appliesEmp
      ? undefined
      : compiled.appliesEmp,
    leavesPuddle: runtimeSpawn && !compiled.leavesPuddle
      ? undefined
      : compiled.leavesPuddle,
    spawnerConfig: compiled.spawnerConfig
      ? { ...compiled.spawnerConfig }
      : undefined,
    damageReductionWhileMoving: runtimeSpawn && compiled.movingReduction === 0
      ? undefined
      : compiled.movingReduction,
    onDeathPuddle: compiled.onDeathPuddle,
    multishot: runtimeSpawn && compiled.multishot === 1
      ? undefined
      : compiled.multishot,
    replicateOnKill: runtimeSpawn && !compiled.replicateOnKill
      ? undefined
      : compiled.replicateOnKill,
    resurrectOnce: runtimeSpawn && !compiled.resurrectOnce
      ? undefined
      : compiled.resurrectOnce,
    stealthUntilAttack: runtimeSpawn && !compiled.stealthUntilAttack
      ? undefined
      : compiled.stealthUntilAttack,
    executeThreshold: runtimeSpawn && compiled.executeThreshold === 0
      ? undefined
      : compiled.executeThreshold,
    lifestealMult: runtimeSpawn && compiled.lifestealMult === 0
      ? undefined
      : compiled.lifestealMult,
    runtimeRules: compileRuntimeRules(primitives),
  }
  prepareRuntimePrimitives(unit, primitives)
  return unit
}

function compileRuntimeRules(
  stats: UnitBaseStats,
): UnitRuntimeRules {
  return {
    baseCombatTags: [...(stats.combatTags ?? [])],
    healTargetTags: stats.healTargetTags
      ? [...stats.healTargetTags]
      : undefined,
    targetingProfile: stats.targetingProfile ?? DEFAULT_TARGETING_PROFILE,
    minimumRange: Math.max(0, stats.minimumRange ?? 0) * 40,
    rampDamage: stats.rampDamage ? { ...stats.rampDamage } : undefined,
    chargeDamage: stats.chargeDamage ? { ...stats.chargeDamage } : undefined,
    percentHpDamage: stats.percentHpDamage
      ? { ...stats.percentHpDamage }
      : undefined,
    mineOnAction: stats.mineOnAction ? { ...stats.mineOnAction } : undefined,
    onKill: stats.onKill
      ? { ...stats.onKill, status: stats.onKill.status
        ? { ...stats.onKill.status }
        : undefined }
      : undefined,
    projectileInterceptable: Boolean(stats.barrageAttack) ||
      Boolean(
        stats.combatTags?.includes('explosive') &&
        stats.range * 40 > 80 &&
        stats.attack > 0,
      ),
    spawnOverrides: stats.spawnOverrides
      ? { ...stats.spawnOverrides }
      : undefined,
  }
}
