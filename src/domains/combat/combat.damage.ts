import type { BattleAction } from './combat.actions'
import type { SimHazard, SimUnit } from './combat.sim.types'
import { applyAccuracyPenalty } from './combat.accuracy'
import { applyFiniteBarriers } from './combat.barrier'
import { applyDamageSharing } from './combat.damage-sharing'
import { getMovementDefenseReduction } from './combat.burrow'
import { getFieldDamageReduction } from './combat.field-effects'
import { getMarkedDamageMultiplier, getMarkedExecuteThreshold } from './combat.mark'
import { applyOutputSuppressionDamage } from './combat.output-suppression'
import { getPercentHpDamage } from './combat.percent-damage'
import { tryInterceptProjectile } from './combat.projectile-defense'
import { getRankDamageMultiplier } from './combat.rank-scaling'
import { getStatusValue } from './combat.status'
import { applySummonCounterDamage } from './combat.summon-counter'
import { applyHealing } from './combat.healing'
import type { SpatialHash } from './spatial-hash'
export interface CombatDamageResult {
  damage: number
  sharedDamage: number
  sharedDamageEvents: { targetId: string; damage: number }[]
  isShieldHit: boolean
  shieldDamage: number
  shieldBroken: boolean
  shieldHitBlock: boolean
  shieldHitBlockedDamage: number
  blockedDamage: number
  barrierBlockedDamage: number
  lifesteal: number
  intercepted: boolean
  barrierBreakEvents: { hazardId: string; sourceUnitId: string }[]
}
export interface CombatDamageContext {
  units?: SimUnit[]
  hazards?: SimHazard[]
  onUnitDeath?: (unit: SimUnit) => void
  allowPercentHpDamage?: boolean
  allowMinimumDamage?: boolean
  interceptable?: boolean
  spatialHash?: SpatialHash
}
/**
 * Applies attack damage through defense, status modifiers, shields, execute, and lifesteal.
 * @param attacker Unit dealing damage
 * @param target Unit receiving damage
 * @param rawDamage Damage before target defense
 * @param actions Optional replay action sink for detailed damage events
 * @param context Optional unit context for defensive primitives
 * @returns final HP damage and shield-hit flag
 */
export function applyCombatDamage(
  attacker: SimUnit,
  target: SimUnit,
  rawDamage: number,
  actions?: BattleAction[],
  context: CombatDamageContext = {}
): CombatDamageResult {
  const boost = getStatusValue(attacker, 'attack_boost') ?? 0
  const boostMult = boost >= 1 ? boost : 1 + boost
  const baseRaw = boost > 0 ? Math.max(0, Math.floor(Math.floor(rawDamage) * Math.min(5, boostMult))) : Math.floor(rawDamage)
  if (baseRaw <= 0) return createDamageResult()
  const percentHpDamage = context.allowPercentHpDamage === false ? 0 : getPercentHpDamage(attacker, target)
  const raw = baseRaw + percentHpDamage
  if (percentHpDamage > 0 && actions) {
    actions.push({ unitId: attacker.id, type: 'percent_hp_damage', targetId: target.id, value: percentHpDamage })
  }
  if (context.interceptable && context.units && tryInterceptProjectile(attacker, target, raw, context.units, actions, context.spatialHash)) {
    return createDamageResult({ blockedDamage: raw, intercepted: true })
  }
  const defense = getEffectiveDefense(attacker, target)
  let damage = context.allowMinimumDamage === false ? Math.max(0, raw - defense) : Math.max(1, raw - defense)

  damage = applyOutputSuppressionDamage(attacker, damage)

  damage = applyAccuracyPenalty(attacker, damage)

  if (target.isFlying && attacker.antiAirDamageMult) damage = Math.floor(damage * attacker.antiAirDamageMult)
  if (!target.isFlying && attacker.groundDamageMult) damage = Math.floor(damage * attacker.groundDamageMult)
  damage = Math.floor(damage * getRankDamageMultiplier(attacker, target))
  damage = applySummonCounterDamage(attacker, target, damage)
  const movementDefenseReduction = getMovementDefenseReduction(target)
  if (movementDefenseReduction > 0) damage = Math.floor(damage * (1 - movementDefenseReduction))
  const beforeFieldReduction = damage
  const finiteBarrier = applyFiniteBarriers(target, damage, context.hazards)
  damage = finiteBarrier.damage
  const fieldReduction = getFieldDamageReduction(target, context.hazards)
  if (fieldReduction > 0) damage = Math.floor(damage * (1 - fieldReduction))
  const barrierBlockedDamage = beforeFieldReduction - damage
  damage = applyStatusDamageModifiers(target, damage)

  const markMult = getMarkedDamageMultiplier(attacker, target)
  if (markMult > 0) damage = Math.max(0, Math.floor(damage * (1 + markMult)))

  damage = applyFlatDamageBlock(target, damage)
  const blockedDamage = Math.max(0, raw - damage)
  const shieldResult = applyShield(target, damage, attacker.shieldDamageMult)
  damage = shieldResult.damage
  let reactiveArmorBlock = 0
  if (damage > 0 && target.reactiveArmorCharges && target.reactiveArmorBlock) {
    target.reactiveArmorCharges--
    reactiveArmorBlock = Math.min(damage, Math.max(0, Math.floor(target.reactiveArmorBlock)))
  }
  damage -= reactiveArmorBlock
  const shareResult = applyDamageSharing(target, damage, context)
  damage = shareResult.damage

  const executeThreshold = Math.max(attacker.executeThreshold ?? 0, getMarkedExecuteThreshold(attacker, target))
  if (executeThreshold > 0 && target.hp <= executeThreshold) damage = target.hp
  let lifesteal = 0
  if (attacker.lifestealMult && damage + shareResult.sharedDamage > 0) {
    const requestedLifesteal = Math.floor((damage + shareResult.sharedDamage) * attacker.lifestealMult)
    lifesteal = applyHealing(attacker.id, attacker, requestedLifesteal)
  }
  if (damage > 0) target.hp -= damage

  const result = {
    ...shieldResult,
    damage,
    sharedDamage: shareResult.sharedDamage,
    sharedDamageEvents: shareResult.events,
    blockedDamage: blockedDamage + shieldResult.shieldHitBlockedDamage + reactiveArmorBlock,
    barrierBlockedDamage,
    barrierBreakEvents: finiteBarrier.breaks,
    lifesteal,
  }
  emitDamageActions(attacker, target, result, actions)
  return result
}
function getEffectiveDefense(attacker: SimUnit, target: SimUnit): number {
  const armorBroken = getStatusValue(target, 'armor_broken') ?? 0
  const defenseReduction = armorBroken <= 1 ? target.defense * armorBroken : armorBroken
  const remainingDefense = Math.max(0, target.defense - defenseReduction)
  const pierceRatio = Math.max(0, Math.min(1, attacker.armorPierceRatio ?? 0))
  return Math.floor(remainingDefense * (1 - pierceRatio))
}

function applyStatusDamageModifiers(target: SimUnit, damage: number): number {
  const vulnerable = getStatusValue(target, 'vulnerable') ?? 0
  const reduction = getStatusValue(target, 'damage_reduction') ?? 0
  let result = damage

  if (vulnerable > 0) result = Math.floor(result * (1 + vulnerable))
  if (reduction > 0) result = Math.floor(result * Math.max(0, 1 - reduction))

  return Math.max(0, result)
}

function applyShield(target: SimUnit, damage: number, shieldDamageMult = 1): CombatDamageResult {
  if (target.shield <= 0) return createDamageResult({ damage })

  const multiplier = Math.max(1, shieldDamageMult)
  const shieldDamageBudget = Math.max(1, Math.floor(damage * multiplier))
  const currentShield = target.shield
  if (target.shield >= shieldDamageBudget) {
    target.shield -= shieldDamageBudget
    return createDamageResult({
      damage: 0,
      isShieldHit: true,
      shieldDamage: shieldDamageBudget,
      shieldBroken: target.shield === 0,
    })
  }

  target.shield = 0
  const overflowDamage = Math.max(0, damage - Math.ceil(currentShield / multiplier))
  if (overflowDamage > 0 && (target.shieldHitBlockCharges ?? 0) > 0) {
    target.shieldHitBlockCharges = Math.max(0, (target.shieldHitBlockCharges ?? 0) - 1)
    return createDamageResult({
      damage: 0,
      isShieldHit: true,
      shieldDamage: currentShield,
      shieldBroken: true,
      shieldHitBlock: true,
      shieldHitBlockedDamage: overflowDamage,
    })
  }

  return createDamageResult({
    damage: overflowDamage,
    isShieldHit: true,
    shieldDamage: currentShield,
    shieldBroken: true,
  })
}

function createDamageResult(overrides: Partial<CombatDamageResult> = {}): CombatDamageResult {
  return {
    damage: 0,
    isShieldHit: false,
    shieldDamage: 0,
    shieldBroken: false,
    sharedDamage: 0,
    sharedDamageEvents: [],
    blockedDamage: 0,
    barrierBlockedDamage: 0,
    lifesteal: 0,
    intercepted: false,
    barrierBreakEvents: [],
    shieldHitBlock: false,
    shieldHitBlockedDamage: 0,
    ...overrides,
  }
}

function applyFlatDamageBlock(target: SimUnit, damage: number): number {
  const config = target.flatDamageBlock
  if (!config || damage <= 0) return damage

  const rank = Math.max(1, target.rank ?? 1)
  const block = Math.max(0, Math.floor(config.amount + (config.perRank ?? 0) * Math.max(0, rank - 1)))
  const minimumDamage = Math.max(0, Math.floor(config.minimumDamage ?? 0))
  return Math.max(minimumDamage, damage - block)
}

function emitDamageActions(
  attacker: SimUnit,
  target: SimUnit,
  result: CombatDamageResult,
  actions?: BattleAction[]
): void {
  if (!actions) return

  if (result.blockedDamage > 0) {
    actions.push({ unitId: target.id, type: 'unit_blocked_damage', targetId: attacker.id, damage: result.blockedDamage })
  }
  if (result.shieldHitBlock) {
    actions.push({ unitId: target.id, type: 'shield_hit_block', targetId: attacker.id, damage: result.shieldHitBlockedDamage })
  }
  if (result.barrierBlockedDamage > 0) {
    actions.push({ unitId: target.id, type: 'barrier_absorb', targetId: attacker.id, damage: result.barrierBlockedDamage })
  }
  for (const event of result.barrierBreakEvents) {
    actions.push({ unitId: event.sourceUnitId, type: 'barrier_break', hazardId: event.hazardId })
  }
  if (result.shieldDamage > 0) {
    actions.push({ unitId: attacker.id, type: 'shield_damage', targetId: target.id, damage: result.shieldDamage, isShieldHit: true })
  }
  if (result.shieldBroken) {
    actions.push({ unitId: attacker.id, type: 'shield_break', targetId: target.id })
  }
  if (result.damage > 0) {
    actions.push({ unitId: attacker.id, type: 'damage', targetId: target.id, damage: result.damage })
  }
  for (const event of result.sharedDamageEvents) {
    actions.push({ unitId: attacker.id, type: 'damage_share', targetId: event.targetId, damage: event.damage })
  }
  if (result.lifesteal > 0) {
    actions.push({ unitId: attacker.id, type: 'lifesteal', targetId: attacker.id, damage: result.lifesteal })
  }
}
