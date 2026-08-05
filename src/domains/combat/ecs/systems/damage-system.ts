import type { BattleAction } from '../../combat.actions'
import type { DeathCause } from '../../combat.death.types'
import type { RuntimeStatusEffect } from '../../combat.sim.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { captureLiveDamageSource, getDamageAttributionMetadata, type DamageAttribution, type DamageSourceContext } from '../damage-source'
import { applyEcsHealing } from './healing-system'
import { applyEcsBarriers } from './damage-barrier-system'
import { applyEcsDamageSharing } from './damage-sharing-system'
import { tryEcsProjectileInterception } from './damage-interception-system'
import { buildEcsDamagePayload } from './damage-payload-system'
import {
  applyAccuracy,
  applyFlatBlock,
  applyMovementReduction,
  applyOutputSuppression,
  applySummonCounter,
  applyTargetStatuses,
  getMarkDamageMultiplier,
  getMarkExecuteThreshold,
  getRankMultiplier,
  getStatusValue,
} from './damage-kernel-helpers'
interface EcsDamageResult {
  damage: number
  bonusDamage: number
  shieldDamage: number
  shieldBroken: boolean
  shieldHitBlock: boolean
  shieldHitBlockedDamage: number
  blockedDamage: number
  barrierBlockedDamage: number
  barrierBreaks: { hazardId: string; sourceUnitId: string }[]
  sharedDamage: number
  sharedDamageEvents: { targetId: string; damage: number }[]
  lifesteal: number
  intercepted: boolean
}
export interface EcsDamageOptions {
  allowPercentHpDamage?: boolean; allowMinimumDamage?: boolean
  interceptable?: boolean
  deathCause?: DeathCause
}
export function applyEcsSingleDamage(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  rawDamage: number,
  actions: BattleAction[],
  options: EcsDamageOptions = {},
): EcsDamageResult {
  return applyEcsDamageWithSource(world, captureLiveDamageSource(world, attackerId), targetId, rawDamage, actions, options)
}

export function applyEcsCapturedDamage(
  world: CombatWorld,
  source: DamageSourceContext,
  targetId: EntityId,
  rawDamage: number,
  actions: BattleAction[],
  options: EcsDamageOptions = {},
): EcsDamageResult {
  return applyEcsDamageWithSource(world, source, targetId, rawDamage, actions, options)
}

function applyEcsDamageWithSource(
  world: CombatWorld,
  source: DamageSourceContext,
  targetId: EntityId,
  rawDamage: number,
  actions: BattleAction[],
  options: EcsDamageOptions,
): EcsDamageResult {
  const targetCombat = world.stores.combat.require(targetId)
  const targetVitality = world.stores.vitality.require(targetId)
  const targetStatus = world.stores.statusControl.require(targetId)
  const targetDefense = world.stores.defense.require(targetId)
  const raw = buildEcsDamagePayload(
    world,
    source,
    targetId,
    rawDamage,
    actions,
    options.allowPercentHpDamage !== false,
  )
  if (raw <= 0) return createResult()
  if (options.interceptable !== false && source.attribution.sourceEntityId !== undefined &&
      world.stores.runtimeRules.get(source.attribution.sourceEntityId) !== undefined &&
      tryEcsProjectileInterception(world, source.attribution.sourceEntityId, targetId, raw, actions)) {
    return createResult({ blockedDamage: raw, intercepted: true })
  }

  const armorBroken = getStatusValue(targetStatus.statusEffects, 'armor_broken') ?? 0
  const defenseReduction = armorBroken <= 1 ? targetCombat.defense * armorBroken : armorBroken
  const remainingDefense = Math.max(0, targetCombat.defense - defenseReduction)
  const pierce = Math.max(0, Math.min(1, source.modifiers.armorPierceRatio))
  const afterDefense = raw - Math.floor(remainingDefense * (1 - pierce))
  let damage = options.allowMinimumDamage === false ? Math.max(0, afterDefense) : Math.max(1, afterDefense)
  damage = applyOutputSuppression(source.modifiers.outputSuppression, damage)
  damage = applyAccuracy(source.modifiers.accuracyPenalty, source.modifiers.accuracyPenaltyResist, damage)
  const targetTransform = world.stores.transform.require(targetId)
  if (targetTransform.isFlying && source.modifiers.antiAirDamageMult) damage = Math.floor(damage * source.modifiers.antiAirDamageMult)
  if (!targetTransform.isFlying && source.modifiers.groundDamageMult) damage = Math.floor(damage * source.modifiers.groundDamageMult)
  damage = Math.floor(damage * getRankMultiplier(world, source, targetId))
  damage = applySummonCounter(world, source, targetId, damage)
  damage = applyMovementReduction(world, targetId, damage)
  const barrier = applyEcsBarriers(world, targetId, damage)
  damage = barrier.damage
  damage = applyTargetStatuses(targetStatus.statusEffects, damage)
  const markMultiplier = getMarkDamageMultiplier(source.attribution.sourceExternalId, targetStatus.targetMark)
  const beforeMark = damage
  if (markMultiplier > 0) damage = Math.max(0, Math.floor(damage * (1 + markMultiplier)))
  const bonusDamage = Math.max(0, damage - beforeMark)
  damage = applyFlatBlock(world, targetId, damage)
  const blockedBeforeShield = Math.max(0, raw - damage)
  const shield = applyShield(world, targetId, damage, source.modifiers.shieldDamageMult)
  damage = shield.damage
  let reactiveBlock = 0
  if (damage > 0 && targetDefense.reactiveArmorCharges && targetDefense.reactiveArmorBlock) {
    targetDefense.reactiveArmorCharges--
    reactiveBlock = Math.min(damage, Math.max(0, Math.floor(targetDefense.reactiveArmorBlock)))
    damage -= reactiveBlock
  }
  const sharing = applyEcsDamageSharing(world, targetId, source.attribution, damage, actions, options.deathCause)
  damage = sharing.damage
  const markedExecute = getMarkExecuteThreshold(source.attribution.sourceExternalId, targetStatus.targetMark)
  const execute = Math.max(source.modifiers.executeThreshold, markedExecute)
  if (execute > 0 && targetVitality.hp <= execute) damage = targetVitality.hp
  let lifesteal = 0
  if (source.modifiers.lifestealMult && source.attribution.sourceEntityId !== undefined &&
      world.stores.vitality.get(source.attribution.sourceEntityId) &&
      !world.stores.vitality.require(source.attribution.sourceEntityId).isDead && damage + sharing.sharedDamage > 0) {
    lifesteal = applyEcsHealing(world, source.attribution.sourceEntityId, source.attribution.sourceEntityId, Math.floor((damage + sharing.sharedDamage) * source.modifiers.lifestealMult))
  }
  if (damage > 0) targetVitality.hp -= damage
  const actionGroup = world.resources.get('actionGroup')
  if (actionGroup?.active && damage > 0) {
    targetVitality.hp += damage
    actionGroup.queueDamage(targetId, source.attribution, damage)
  }
  const result = {
    ...shield,
    damage,
    bonusDamage,
    blockedDamage: blockedBeforeShield + shield.shieldHitBlockedDamage + reactiveBlock,
    barrierBlockedDamage: barrier.blockedDamage,
    barrierBreaks: barrier.breaks,
    sharedDamage: sharing.sharedDamage,
    sharedDamageEvents: sharing.events,
    lifesteal,
  }
  emitDamageActions(world, source.attribution, targetId, result, actions)
  return result
}
function applyShield(world: CombatWorld, targetId: EntityId, damage: number, shieldMultiplier = 1): EcsDamageResult {
  const vitality = world.stores.vitality.require(targetId)
  const defense = world.stores.defense.require(targetId)
  if (vitality.shield <= 0) return createResult({ damage })
  const multiplier = Math.max(1, shieldMultiplier)
  const budget = Math.max(1, Math.floor(damage * multiplier))
  const currentShield = vitality.shield
  if (vitality.shield >= budget) {
    vitality.shield -= budget
    return createResult({ damage: 0, shieldDamage: budget, shieldBroken: vitality.shield === 0 })
  }
  vitality.shield = 0
  const overflow = Math.max(0, damage - Math.ceil(currentShield / multiplier))
  if (overflow > 0 && (defense.shieldHitBlockCharges ?? 0) > 0) {
    defense.shieldHitBlockCharges = Math.max(0, (defense.shieldHitBlockCharges ?? 0) - 1)
    return createResult({
      damage: 0, shieldDamage: currentShield, shieldBroken: true,
      shieldHitBlock: true, shieldHitBlockedDamage: overflow,
    })
  }
  return createResult({ damage: overflow, shieldDamage: currentShield, shieldBroken: true })
}
function emitDamageActions(world: CombatWorld, attribution: DamageAttribution, targetId: EntityId, result: EcsDamageResult, actions: BattleAction[]): void {
  const attacker = attribution.sourceExternalId
  const sourceMetadata = getDamageAttributionMetadata(world, attribution)
  const target = world.stores.identity.require(targetId).id
  if (result.blockedDamage > 0) actions.push({ unitId: target, type: 'unit_blocked_damage', targetId: attacker, damage: result.blockedDamage })
  if (result.shieldHitBlock) actions.push({ unitId: target, type: 'shield_hit_block', targetId: attacker, damage: result.shieldHitBlockedDamage })
  if (result.barrierBlockedDamage > 0) actions.push({ unitId: target, type: 'barrier_absorb', targetId: attacker, damage: result.barrierBlockedDamage })
  for (const event of result.barrierBreaks) actions.push({ unitId: event.sourceUnitId, type: 'barrier_break', hazardId: event.hazardId })
  if (result.shieldDamage > 0) actions.push({ unitId: attacker, type: 'shield_damage', targetId: target, damage: result.shieldDamage, isShieldHit: true, ...sourceMetadata })
  if (result.shieldBroken) actions.push({ unitId: attacker, type: 'shield_break', targetId: target, ...sourceMetadata })
  if (result.damage > 0) actions.push({ unitId: attacker, type: 'damage', targetId: target, damage: result.damage, ...(result.bonusDamage > 0 ? { bonusDamage: result.bonusDamage } : {}), ...sourceMetadata })
  for (const event of result.sharedDamageEvents) actions.push({ unitId: attacker, type: 'damage_share', targetId: event.targetId, damage: event.damage, ...sourceMetadata })
  if (result.lifesteal > 0) actions.push({ unitId: attacker, type: 'lifesteal', targetId: attacker, damage: result.lifesteal, ...sourceMetadata })
}

function createResult(overrides: Partial<EcsDamageResult> = {}): EcsDamageResult {
  return {
    damage: 0, bonusDamage: 0, shieldDamage: 0, shieldBroken: false,
    shieldHitBlock: false, shieldHitBlockedDamage: 0,
    blockedDamage: 0, barrierBlockedDamage: 0, barrierBreaks: [],
    sharedDamage: 0, sharedDamageEvents: [],
    lifesteal: 0, intercepted: false, ...overrides,
  }
}
