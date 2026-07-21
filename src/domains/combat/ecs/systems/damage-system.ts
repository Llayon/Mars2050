import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { DeathCause } from '../../combat.death.types'
import type { RuntimeStatusEffect } from '../../combat.sim.types'
import type { UnitTypeKey } from '../../combat.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsHealing } from './healing-system'
import { applyEcsBarriers } from './damage-barrier-system'
import { applyEcsDamageSharing } from './damage-sharing-system'
import { tryEcsProjectileInterception } from './damage-interception-system'
import { buildEcsDamagePayload } from './damage-payload-system'
interface EcsDamageResult {
  damage: number
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
  allowPercentHpDamage?: boolean
  allowMinimumDamage?: boolean
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
  const attackerIdentity = world.stores.identity.require(attackerId)
  const targetIdentity = world.stores.identity.require(targetId)
  const attacker = world.stores.combat.require(attackerId)
  const targetCombat = world.stores.combat.require(targetId)
  const targetVitality = world.stores.vitality.require(targetId)
  const attackerStatus = world.stores.statusControl.require(attackerId)
  const targetStatus = world.stores.statusControl.require(targetId)
  const targetDefense = world.stores.defense.require(targetId)
  const raw = buildEcsDamagePayload(
    world,
    attackerId,
    targetId,
    rawDamage,
    actions,
    options.allowPercentHpDamage !== false,
  )
  if (raw <= 0) return createResult()
  if (options.interceptable !== false &&
      tryEcsProjectileInterception(world, attackerId, targetId, raw, actions)) {
    return createResult({ blockedDamage: raw, intercepted: true })
  }

  const armorBroken = getStatusValue(targetStatus.statusEffects, 'armor_broken') ?? 0
  const defenseReduction = armorBroken <= 1 ? targetCombat.defense * armorBroken : armorBroken
  const remainingDefense = Math.max(0, targetCombat.defense - defenseReduction)
  const pierce = Math.max(0, Math.min(1, attacker.armorPierceRatio ?? 0))
  const afterDefense = raw - Math.floor(remainingDefense * (1 - pierce))
  let damage = options.allowMinimumDamage === false ? Math.max(0, afterDefense) : Math.max(1, afterDefense)
  damage = applyOutputSuppression(attackerStatus.statusEffects, damage)
  damage = applyAccuracy(attackerStatus.statusEffects, attacker.accuracyPenaltyResist, damage)
  const targetTransform = world.stores.transform.require(targetId)
  if (targetTransform.isFlying && attacker.antiAirDamageMult) damage = Math.floor(damage * attacker.antiAirDamageMult)
  if (!targetTransform.isFlying && attacker.groundDamageMult) damage = Math.floor(damage * attacker.groundDamageMult)
  damage = Math.floor(damage * getRankMultiplier(world, attackerId, targetId))
  damage = applySummonCounter(world, attackerId, targetId, damage)
  damage = applyMovementReduction(world, targetId, damage)
  const barrier = applyEcsBarriers(world, targetId, damage)
  damage = barrier.damage
  damage = applyTargetStatuses(targetStatus.statusEffects, damage)
  const markMultiplier = getMarkDamageMultiplier(attackerIdentity.id, targetStatus.targetMark)
  if (markMultiplier > 0) damage = Math.max(0, Math.floor(damage * (1 + markMultiplier)))
  damage = applyFlatBlock(world, targetId, damage)
  const blockedBeforeShield = Math.max(0, raw - damage)
  const shield = applyShield(world, targetId, damage, attacker.shieldDamageMult)
  damage = shield.damage
  let reactiveBlock = 0
  if (damage > 0 && targetDefense.reactiveArmorCharges && targetDefense.reactiveArmorBlock) {
    targetDefense.reactiveArmorCharges--
    reactiveBlock = Math.min(damage, Math.max(0, Math.floor(targetDefense.reactiveArmorBlock)))
    damage -= reactiveBlock
  }
  const sharing = applyEcsDamageSharing(world, targetId, attackerId, damage, actions, options.deathCause)
  damage = sharing.damage
  const markedExecute = getMarkExecuteThreshold(attackerIdentity.id, targetStatus.targetMark)
  const execute = Math.max(attacker.executeThreshold ?? 0, markedExecute)
  if (execute > 0 && targetVitality.hp <= execute) damage = targetVitality.hp
  let lifesteal = 0
  if (attacker.lifestealMult && damage + sharing.sharedDamage > 0) {
    lifesteal = applyEcsHealing(world, attackerId, attackerId, Math.floor((damage + sharing.sharedDamage) * attacker.lifestealMult))
  }
  if (damage > 0) targetVitality.hp -= damage
  const result = {
    ...shield,
    damage,
    blockedDamage: blockedBeforeShield + shield.shieldHitBlockedDamage + reactiveBlock,
    barrierBlockedDamage: barrier.blockedDamage,
    barrierBreaks: barrier.breaks,
    sharedDamage: sharing.sharedDamage,
    sharedDamageEvents: sharing.events,
    lifesteal,
  }
  emitDamageActions(world, attackerId, targetId, result, actions)
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

function emitDamageActions(world: CombatWorld, attackerId: EntityId, targetId: EntityId, result: EcsDamageResult, actions: BattleAction[]): void {
  const attacker = world.stores.identity.require(attackerId).id
  const target = world.stores.identity.require(targetId).id
  if (result.blockedDamage > 0) actions.push({ unitId: target, type: 'unit_blocked_damage', targetId: attacker, damage: result.blockedDamage })
  if (result.shieldHitBlock) actions.push({ unitId: target, type: 'shield_hit_block', targetId: attacker, damage: result.shieldHitBlockedDamage })
  if (result.barrierBlockedDamage > 0) actions.push({ unitId: target, type: 'barrier_absorb', targetId: attacker, damage: result.barrierBlockedDamage })
  for (const event of result.barrierBreaks) actions.push({ unitId: event.sourceUnitId, type: 'barrier_break', hazardId: event.hazardId })
  if (result.shieldDamage > 0) actions.push({ unitId: attacker, type: 'shield_damage', targetId: target, damage: result.shieldDamage, isShieldHit: true })
  if (result.shieldBroken) actions.push({ unitId: attacker, type: 'shield_break', targetId: target })
  if (result.damage > 0) actions.push({ unitId: attacker, type: 'damage', targetId: target, damage: result.damage })
  for (const event of result.sharedDamageEvents) actions.push({ unitId: attacker, type: 'damage_share', targetId: event.targetId, damage: event.damage })
  if (result.lifesteal > 0) actions.push({ unitId: attacker, type: 'lifesteal', targetId: attacker, damage: result.lifesteal })
}

function applyOutputSuppression(effects: RuntimeStatusEffect[], damage: number): number {
  let suppression = 0
  for (const effect of effects) {
    if (effect.type === 'output_suppressed' && effect.duration > 0 && effect.value && effect.value > 0) {
      suppression += effect.value <= 1 ? effect.value : effect.value / 100
    }
  }
  suppression = Math.min(0.5, suppression)
  return suppression > 0 ? Math.max(0, Math.floor(damage * (1 - suppression))) : damage
}

function applyAccuracy(effects: RuntimeStatusEffect[], resistValue: number | undefined, damage: number): number {
  const penalty = getStatusValue(effects, 'accuracy_reduced') ?? 0
  if (damage <= 0 || penalty <= 0) return damage
  const resist = Math.max(0, Math.min(1, resistValue ?? 0))
  const effective = Math.max(0, Math.min(0.95, penalty * (1 - resist)))
  return Math.max(0, Math.floor(damage * (1 - effective)))
}

function applyTargetStatuses(effects: RuntimeStatusEffect[], damage: number): number {
  const vulnerable = getStatusValue(effects, 'vulnerable') ?? 0
  const reduction = getStatusValue(effects, 'damage_reduction') ?? 0
  let result = damage
  if (vulnerable > 0) result = Math.floor(result * (1 + vulnerable))
  if (reduction > 0) result = Math.floor(result * Math.max(0, 1 - reduction))
  return Math.max(0, result)
}

function applyMovementReduction(world: CombatWorld, targetId: EntityId, damage: number): number {
  const movement = world.stores.movement.require(targetId)
  const effects = world.stores.statusControl.require(targetId).statusEffects
  const moving = movement.isMoving ? movement.damageReductionWhileMoving ?? 0 : 0
  const revealed = effects.some(effect => effect.type === 'revealed' && effect.duration > 0)
  const burrow = movement.isBurrowed && !revealed ? movement.burrowConfig?.damageReduction ?? 0 : 0
  const reduction = Math.max(0, Math.min(0.9, Math.max(moving, burrow)))
  return reduction > 0 ? Math.floor(damage * (1 - reduction)) : damage
}

function applyFlatBlock(world: CombatWorld, targetId: EntityId, damage: number): number {
  const config = world.stores.defense.require(targetId).flatDamageBlock
  if (!config || damage <= 0) return damage
  const rank = Math.max(1, world.stores.identity.require(targetId).rank ?? 1)
  const block = Math.max(0, Math.floor(config.amount + (config.perRank ?? 0) * Math.max(0, rank - 1)))
  return Math.max(Math.max(0, Math.floor(config.minimumDamage ?? 0)), damage - block)
}

function getRankMultiplier(world: CombatWorld, attackerId: EntityId, targetId: EntityId): number {
  const attacker = world.stores.identity.require(attackerId)
  const target = world.stores.identity.require(targetId)
  const relation = (attacker.rank ?? 1) === (target.rank ?? 1) ? 'same_rank' : (target.rank ?? 1) > (attacker.rank ?? 1) ? 'higher_rank' : 'lower_rank'
  let multiplier = 1
  for (const modifier of world.stores.combat.require(attackerId).rankScaling?.damageModifiers ?? []) {
    if (modifier.relation === relation) multiplier *= Math.max(0, modifier.multiplier)
  }
  return multiplier
}

function applySummonCounter(world: CombatWorld, attackerId: EntityId, targetId: EntityId, damage: number): number {
  const multiplier = Math.max(1, world.stores.combat.require(attackerId).summonCounterDamageMult ?? 1)
  if (multiplier <= 1) return damage
  const identity = world.stores.identity.require(targetId)
  const vitality = world.stores.vitality.require(targetId)
  const tags = UNIT_TYPES[identity.type as UnitTypeKey]?.baseStats.combatTags ?? []
  const summon = world.stores.weapon.require(targetId).attackType === 'spawn' || world.stores.entityTargets.require(targetId).summonOwner !== undefined ||
    vitality.isTemporary || tags.includes('summoner')
  return summon ? Math.floor(damage * multiplier) : damage
}
function getMarkDamageMultiplier(attackerId: string, mark: ReturnType<CombatWorld['stores']['statusControl']['require']>['targetMark']): number {
  if (!mark || mark.duration <= 0 || !mark.sharedDamage && mark.sourceUnitId !== attackerId) return 0
  return Math.max(0, mark.damageMultiplier ?? 0)
}

function getMarkExecuteThreshold(attackerId: string, mark: ReturnType<CombatWorld['stores']['statusControl']['require']>['targetMark']): number {
  if (!mark || mark.duration <= 0 || mark.sourceUnitId !== attackerId) return 0
  return Math.max(0, Math.floor(mark.executeThreshold ?? 0))
}

function getStatusValue(effects: RuntimeStatusEffect[], type: RuntimeStatusEffect['type']): number | undefined {
  let value: number | undefined
  for (const effect of effects) {
    if (effect.type !== type || effect.duration <= 0) continue
    if (value === undefined) value = effect.value
    else if (effect.value !== undefined) value = type === 'slow' && value <= 1 && effect.value <= 1 ? Math.min(value, effect.value) : Math.max(value, effect.value)
  }
  return value
}

function createResult(overrides: Partial<EcsDamageResult> = {}): EcsDamageResult {
  return {
    damage: 0, shieldDamage: 0, shieldBroken: false,
    shieldHitBlock: false, shieldHitBlockedDamage: 0,
    blockedDamage: 0, barrierBlockedDamage: 0, barrierBreaks: [],
    sharedDamage: 0, sharedDamageEvents: [],
    lifesteal: 0, intercepted: false, ...overrides,
  }
}
