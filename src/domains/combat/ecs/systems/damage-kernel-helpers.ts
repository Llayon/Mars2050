import type { RuntimeStatusEffect } from '../../combat.sim.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { DamageSourceContext } from '../damage-source'
import { getEcsCombatTags } from '../targeting-evaluation'
import {
  applyAccuracyPure,
  applyFlatBlockPure,
  applyMovementReductionPure,
  applyOutputSuppressionPure,
  applySummonCounterPure,
  applyTargetStatusesPure,
  getMarkDamageMultiplierPure,
  getMarkExecuteThresholdPure,
  getRankMultiplierPure,
  getStatusValuePure,
} from '../damage-kernel-pure'

export function applyOutputSuppression(suppression: number, damage: number): number {
  return applyOutputSuppressionPure(suppression, damage)
}

export function applyAccuracy(penalty: number, resistValue: number, damage: number): number {
  return applyAccuracyPure(penalty, resistValue, damage)
}

export function applyTargetStatuses(effects: RuntimeStatusEffect[], damage: number): number {
  return applyTargetStatusesPure(effects, damage)
}

export function applyMovementReduction(world: CombatWorld, targetId: EntityId, damage: number): number {
  const movement = world.stores.movement.require(targetId)
  const effects = world.stores.statusControl.require(targetId).statusEffects
  const moving = movement.damageReductionWhileMoving ?? 0
  const revealed = effects.some(effect => effect.type === 'revealed' && effect.duration > 0)
  return applyMovementReductionPure(movement.isMoving === true, moving, movement.isBurrowed === true, movement.burrowConfig?.damageReduction ?? 0, revealed, damage)
}

export function applyFlatBlock(world: CombatWorld, targetId: EntityId, damage: number): number {
  const config = world.stores.defense.require(targetId).flatDamageBlock
  const rank = Math.max(1, world.stores.identity.require(targetId).rank ?? 1)
  return applyFlatBlockPure(config, rank, damage)
}

export function getRankMultiplier(world: CombatWorld, source: DamageSourceContext, targetId: EntityId): number {
  const target = world.stores.identity.require(targetId)
  return getRankMultiplierPure(source.modifiers.rank ?? 1, target.rank ?? 1, source.modifiers.rankScaling)
}

export function applySummonCounter(world: CombatWorld, source: DamageSourceContext, targetId: EntityId, damage: number): number {
  const multiplier = Math.max(1, source.modifiers.summonCounterDamageMult)
  const vitality = world.stores.vitality.require(targetId)
  const tags = getEcsCombatTags(world, targetId)
  const summon = world.stores.weapon.require(targetId).attackType === 'spawn' || world.stores.entityTargets.require(targetId).summonOwner !== undefined || vitality.isTemporary || tags.includes('summoner')
  return applySummonCounterPure(summon, multiplier, damage)
}

export function getMarkDamageMultiplier(sourceExternalId: string, mark: ReturnType<CombatWorld['stores']['statusControl']['require']>['targetMark']): number {
  return getMarkDamageMultiplierPure(sourceExternalId, mark)
}

export function getMarkExecuteThreshold(sourceExternalId: string, mark: ReturnType<CombatWorld['stores']['statusControl']['require']>['targetMark']): number {
  return getMarkExecuteThresholdPure(sourceExternalId, mark)
}

export function getStatusValue(effects: RuntimeStatusEffect[], type: RuntimeStatusEffect['type']): number | undefined {
  return getStatusValuePure(effects, type)
}
