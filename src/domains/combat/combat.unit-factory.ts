import { UNIT_TYPES } from './combat.config'
import { prepareRuntimePrimitives } from './combat.runtime-primitives'
import type { SimUnit, Team } from './combat.sim.types'
import type { UnitTypeKey } from './combat.types'
import { assertValidWeaponLoadout } from './combat.weapon-validation'

export interface RuntimeUnitFactoryInput {
  id: string
  team: Team
  type: string
  x: number
  y: number
  currentAngle: number
  summonOwnerId?: string
  summonSourceId?: string
  hp?: number
  attack?: number
  isTemporary?: boolean
  temporaryDuration?: number
}

export function createRuntimeUnitFromConfig(input: RuntimeUnitFactoryInput): SimUnit | null {
  const config = UNIT_TYPES[input.type as UnitTypeKey]
  if (!config) return null
  const stats = config.baseStats
  assertValidWeaponLoadout(input.type, stats)
  const hp = Math.max(1, Math.floor(input.hp ?? stats.hp))
  const modeSwitchConfig = stats.modeSwitch ? { ...stats.modeSwitch } : undefined
  const unit: SimUnit = {
    id: input.id,
    team: input.team,
    type: input.type,
    hp,
    maxHp: hp,
    attack: Math.round(input.attack ?? stats.attack),
    defense: stats.defense,
    speed: stats.speed * 15,
    range: stats.range * 40,
    attackType: stats.attackType,
    aoeRadius: stats.aoeRadius ? stats.aoeRadius * 40 : undefined,
    spawnType: stats.spawnType,
    spawnCap: stats.spawnCap,
    actionCooldownMax: stats.actionCooldownMax ?? 10,
    actionCooldown: 0,
    isFlying: modeSwitchConfig ? (modeSwitchConfig.startMode ?? 'ground') === 'air' : (stats.isFlying ?? false),
    canTargetAir: stats.canTargetAir ?? false,
    isTemporary: input.isTemporary,
    temporaryDuration: input.temporaryDuration,
    x: input.x,
    y: input.y,
    isDead: false,
    summonOwnerId: input.summonOwnerId,
    summonSourceId: input.summonSourceId,
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    turnSpeed: stats.turnSpeed ?? 0.5,
    currentAngle: input.currentAngle,
    initialAngle: input.currentAngle,
    size: stats.size ?? 'M',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    statusOnHit: stats.statusOnHit?.map(status => ({ ...status })),
    markOnHit: stats.markOnHit ? { ...stats.markOnHit } : undefined,
    supportAuras: stats.supportAuras?.map(aura => ({ ...aura })),
    groundDamageMult: 1,
    shieldDamageMult: stats.shieldDamageMult ?? 1,
    armorPierceRatio: stats.armorPierceRatio,
    summonCounterDamageMult: stats.summonCounterDamageMult,
    accuracyPenaltyResist: stats.accuracyPenaltyResist,
    burrowConfig: stats.burrowWhileMoving ? { ...stats.burrowWhileMoving } : undefined,
    isBurrowed: false,
    modeSwitchConfig,
    mobilityMode: modeSwitchConfig?.startMode ?? (modeSwitchConfig ? 'ground' : undefined),
    pullOnHit: stats.pullOnHit ? { radius: stats.pullOnHit.radius * 40, strength: stats.pullOnHit.strength * 40, maxTargets: stats.pullOnHit.maxTargets } : undefined,
    knockbackOnHit: stats.knockbackOnHit ? { radius: stats.knockbackOnHit.radius * 40, strength: stats.knockbackOnHit.strength * 40, maxTargets: stats.knockbackOnHit.maxTargets } : undefined,
    reactiveArmorCharges: stats.reactiveArmor?.charges,
    reactiveArmorBlock: stats.reactiveArmor?.block,
    damageShareRadius: stats.damageShare?.radius ? stats.damageShare.radius * 40 : undefined,
    damageShareRatio: stats.damageShare?.ratio,
    damageShareMaxTargets: stats.damageShare?.maxTargets,
    projectileInterceptRadius: stats.projectileInterception?.radius,
    projectileInterceptCooldownMax: stats.projectileInterception?.cooldownTicks,
    projectileInterceptCooldown: 0,
    projectileInterceptMaxDamage: stats.projectileInterception?.maxDamage,
    smokeOnAction: stats.smokeOnAction ? { ...stats.smokeOnAction } : undefined,
    stanceConfig: stats.stance ? { ...stats.stance } : undefined,
    stanceMode: stats.stance ? 'mobile' : undefined,
    stanceTicks: 0,
    antiAirDamageMult: stats.antiAirDamageMult,
  }
  prepareRuntimePrimitives(unit, stats)
  return unit
}

export function cloneRuntimeUnit(source: SimUnit, id: string, x: number, y: number): SimUnit {
  const clone = structuredClone(source)
  return {
    ...clone,
    id,
    hp: source.maxHp,
    x,
    y,
    actionCooldown: 0,
    shield: source.maxShield,
    statusEffects: [],
    targetMark: undefined,
    attackTargetId: undefined,
    meleeSlotTargetId: undefined,
    meleeSlotIndex: undefined,
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    isDead: false,
    squadId: undefined,
  }
}
