import type { RuntimeStatusEffect } from '../../combat.sim.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { DamageSourceContext } from '../damage-source'
import { getEcsCombatTags } from '../targeting-evaluation'

export function applyOutputSuppression(suppression: number, damage: number): number {
  return suppression > 0 ? Math.max(0, Math.floor(damage * (1 - suppression))) : damage
}

export function applyAccuracy(penalty: number, resistValue: number, damage: number): number {
  if (damage <= 0 || penalty <= 0) return damage
  const resist = Math.max(0, Math.min(1, resistValue))
  const effective = Math.max(0, Math.min(0.95, penalty * (1 - resist)))
  return Math.max(0, Math.floor(damage * (1 - effective)))
}

export function applyTargetStatuses(effects: RuntimeStatusEffect[], damage: number): number {
  const vulnerable = getStatusValue(effects, 'vulnerable') ?? 0
  const reduction = getStatusValue(effects, 'damage_reduction') ?? 0
  let result = damage
  if (vulnerable > 0) result = Math.floor(result * (1 + vulnerable))
  if (reduction > 0) result = Math.floor(result * Math.max(0, 1 - reduction))
  return Math.max(0, result)
}

export function applyMovementReduction(world: CombatWorld, targetId: EntityId, damage: number): number {
  const movement = world.stores.movement.require(targetId)
  const effects = world.stores.statusControl.require(targetId).statusEffects
  const moving = movement.isMoving ? movement.damageReductionWhileMoving ?? 0 : 0
  const revealed = effects.some(effect => effect.type === 'revealed' && effect.duration > 0)
  const burrow = movement.isBurrowed && !revealed ? movement.burrowConfig?.damageReduction ?? 0 : 0
  const reduction = Math.max(0, Math.min(0.9, Math.max(moving, burrow)))
  return reduction > 0 ? Math.floor(damage * (1 - reduction)) : damage
}

export function applyFlatBlock(world: CombatWorld, targetId: EntityId, damage: number): number {
  const config = world.stores.defense.require(targetId).flatDamageBlock
  if (!config || damage <= 0) return damage
  const rank = Math.max(1, world.stores.identity.require(targetId).rank ?? 1)
  const block = Math.max(0, Math.floor(config.amount + (config.perRank ?? 0) * Math.max(0, rank - 1)))
  return Math.max(Math.max(0, Math.floor(config.minimumDamage ?? 0)), damage - block)
}

export function getRankMultiplier(world: CombatWorld, source: DamageSourceContext, targetId: EntityId): number {
  const target = world.stores.identity.require(targetId)
  const sourceRank = source.modifiers.rank ?? 1
  const relation = sourceRank === (target.rank ?? 1) ? 'same_rank' : (target.rank ?? 1) > sourceRank ? 'higher_rank' : 'lower_rank'
  let multiplier = 1
  for (const modifier of source.modifiers.rankScaling?.damageModifiers ?? []) {
    if (modifier.relation === relation) multiplier *= Math.max(0, modifier.multiplier)
  }
  return multiplier
}

export function applySummonCounter(world: CombatWorld, source: DamageSourceContext, targetId: EntityId, damage: number): number {
  const multiplier = Math.max(1, source.modifiers.summonCounterDamageMult)
  if (multiplier <= 1) return damage
  const vitality = world.stores.vitality.require(targetId)
  const tags = getEcsCombatTags(world, targetId)
  const summon = world.stores.weapon.require(targetId).attackType === 'spawn' || world.stores.entityTargets.require(targetId).summonOwner !== undefined || vitality.isTemporary || tags.includes('summoner')
  return summon ? Math.floor(damage * multiplier) : damage
}

export function getMarkDamageMultiplier(sourceExternalId: string, mark: ReturnType<CombatWorld['stores']['statusControl']['require']>['targetMark']): number {
  if (!mark || mark.duration <= 0 || !mark.sharedDamage && mark.sourceUnitId !== sourceExternalId) return 0
  return Math.max(0, mark.damageMultiplier ?? 0)
}

export function getMarkExecuteThreshold(sourceExternalId: string, mark: ReturnType<CombatWorld['stores']['statusControl']['require']>['targetMark']): number {
  if (!mark || mark.duration <= 0 || mark.sourceUnitId !== sourceExternalId) return 0
  return Math.max(0, Math.floor(mark.executeThreshold ?? 0))
}

export function getStatusValue(effects: RuntimeStatusEffect[], type: RuntimeStatusEffect['type']): number | undefined {
  let value: number | undefined
  for (const effect of effects) {
    if (effect.type !== type || effect.duration <= 0 || effect.value === undefined) continue
    value = value === undefined ? effect.value : Math.max(value, effect.value)
  }
  return value
}
