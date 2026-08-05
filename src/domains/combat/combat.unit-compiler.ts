import { prepareRuntimePrimitives } from './combat.runtime-primitives'
import type { SimUnit } from './combat.sim.types'
import { getUnitSupportAuras } from './combat.support-aura-config'
import { DEFAULT_TARGETING_PROFILE } from './combat.targeting.config'
import type {
  UnitBuildSpec,
  UnitRuntimeRules,
} from './combat.unit-build.types'
import type { UnitBaseStats } from './combat.types'
import type { SupportAura } from './combat.primitives'
import {
  compileUnitStats,
  resolveUnitUpgradeIds,
} from './combat.unit-stat-compiler'
import { assertValidWeaponLoadout } from './combat.weapon-validation'
import { compileAbilityDefinitions } from './combat.ability-compiler'
import { compileTemporalWeaponPlan } from './combat.temporal-compiler'
import { auraAbility, extractSupportAuras, periodicAbility } from './combat.ability-config'
import { createLegacyAbilityDefinitions } from './combat.ability-legacy'
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
  const abilityPrograms = compileAbilityDefinitions([
    ...createLegacyAbilityDefinitions(spec.definitionId, primitives),
    ...(primitives.abilities ?? []),
  ])
  const temporalPlan = compileTemporalWeaponPlan(spec.definitionId, primitives, abilityPrograms)
  const periodicPrograms = compileAbilityDefinitions((primitives.periodicAbilities ?? [])
    .map(ability => periodicAbility(`${spec.definitionId}:periodic:${ability.id}`, ability)))
  const authoredSupportAuras = extractSupportAuras(primitives.abilities)
  const resolvedUpgradeIds = resolveUnitUpgradeIds(spec)
  const resolvedSupportAuras = getUnitSupportAuras(
    [...(primitives.supportAuras ?? []), ...authoredSupportAuras],
    resolvedUpgradeIds,
  )
  const upgradeSupportPrograms = compileAbilityDefinitions((resolvedSupportAuras ?? [])
    .filter(aura => !authoredSupportAuras.some(authored => sameSupportAura(authored, aura)))
    .map((aura, index) => auraAbility(`${spec.definitionId}:upgrade_aura:${index}`, aura)))
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
    delivery: primitives.delivery ? { ...primitives.delivery } : undefined,
    abilityPrograms,
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
    supportAuras: resolvedSupportAuras ?? authoredSupportAuras,
    supportPrograms: [
      ...abilityPrograms.filter(program => program.groups.some(group =>
        group.effects.some(effect => effect.kind === 'support_aura'))),
      ...upgradeSupportPrograms,
    ],
    periodicPrograms,
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
    runtimeRules: compileRuntimeRules(primitives, spec.executionMode ?? 'compiled', temporalPlan),
  }
  prepareRuntimePrimitives(unit, primitives)
  if (!runtimeSpawn && periodicPrograms.length > 0) {
    unit.periodicProgramState = unit.periodicAbilities
    unit.periodicAbilities = undefined
  }
  return unit
}
function compileRuntimeRules(
  stats: UnitBaseStats,
  abilityExecutionMode: 'compiled' | 'legacy_mutable' = 'compiled',
  temporalPlan?: ReturnType<typeof compileTemporalWeaponPlan>,
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
    abilityExecutionMode,
    abilityProgramsAuthoritative: abilityExecutionMode === 'compiled',
    spawnOverrides: stats.spawnOverrides
      ? { ...stats.spawnOverrides }
      : undefined,
    temporalPlan,
  }
}

function sameSupportAura(left: SupportAura, right: SupportAura): boolean {
  return left.type === right.type && left.radius === right.radius &&
    left.value === right.value && left.duration === right.duration &&
    left.interval === right.interval && left.target === right.target &&
    JSON.stringify(left.targetTags ?? []) === JSON.stringify(right.targetTags ?? [])
}
