import type { BattleAction } from '../../combat.actions'
import type { DeathCause } from '../../combat.death.types'
import type { RuntimeStatusEffect, StatusEffect } from '../../combat.primitives'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getStatusStackIdentity } from '../../combat.status-core'
import { applyEcsCapturedDamage } from './damage-system'
import { applyEcsHealingFromSource } from './healing-system'
import { clearStatusDamageAttribution, getStatusDamageAttribution, type DamageAttribution } from '../damage-source'

export type EcsStatusDeathHandler = (
  entityId: EntityId,
  sourceId: EntityId | DamageAttribution | undefined,
  cause: DeathCause,
) => void

export function runStatusSystem(
  world: CombatWorld,
  actions: BattleAction[],
  onUnitDeath: EcsStatusDeathHandler,
): void {
  for (const entityId of world.query(['identity', 'vitality', 'statusControl', 'activeStatusCapability'])) {
    const identity = world.stores.identity.require(entityId)
    const vitality = world.stores.vitality.require(entityId)
    const statusControl = world.stores.statusControl.require(entityId)
    if (!identity.id || !statusControl.statusEffects) continue

    for (let index = statusControl.statusEffects.length - 1; index >= 0; index--) {
      const effect = statusControl.statusEffects[index]
      effect.duration--
      if (effect.tickInterval > 0) {
        effect.nextTickIn--
        if (effect.nextTickIn <= 0) {
          applyPeriodicEffect(world, entityId, identity.id, vitality, effect, actions, onUnitDeath)
          effect.nextTickIn = effect.tickInterval
        }
      }
      if (effect.duration > 0) continue
      statusControl.statusEffects.splice(index, 1)
      world.sourceRefs.clear(world, entityId, getStatusStackIdentity(effect))
      clearStatusDamageAttribution(world, entityId, effect)
      actions.push({ unitId: identity.id, type: 'status_expire', statusType: effect.type })
    }
    if (statusControl.statusEffects.length === 0) {
      world.setUnitCapability(entityId, 'activeStatusCapability', false)
    }
  }
}

function applyPeriodicEffect(
  world: CombatWorld,
  entityId: EntityId,
  externalId: string,
  vitality: { hp?: number; maxHp?: number; isDead?: boolean },
  effect: RuntimeStatusEffect,
  actions: BattleAction[],
  onUnitDeath: EcsStatusDeathHandler,
): void {
  if (vitality.isDead || vitality.hp === undefined || vitality.maxHp === undefined) return
  const sourceId = effect.sourceUnitId ?? effect.type
  if (effect.type === 'regen') {
    const requested = Math.max(1, Math.floor(effect.value ?? vitality.maxHp * 0.02))
    if (world.resources.get('defenseResolutionMode') === 'v9_snapshot' && world.resources.get('actionGroup')?.active) {
      applyEcsHealingFromSource(world, sourceId, entityId, requested, actions, { bypassStatusBlock: true })
      actions.push({ unitId: sourceId, type: 'status_tick', targetId: externalId, statusType: effect.type, value: requested })
      return
    }
    const before = Math.max(0, Math.min(vitality.maxHp, vitality.hp))
    vitality.hp = Math.min(vitality.maxHp, before + requested)
    const actual = vitality.hp - before
    if (actual > 0) {
      actions.push({ unitId: sourceId, type: 'heal', targetId: externalId, damage: actual, statusType: effect.type })
      actions.push({ unitId: sourceId, type: 'status_tick', targetId: externalId, statusType: effect.type, value: actual })
    }
    return
  }

    const damage = getPeriodicDamage(vitality.maxHp, effect)
    if (damage <= 0) return
    if (world.resources.get('defenseResolutionMode') === 'v9_snapshot' && world.resources.get('actionGroup')?.active) {
      const damageCause = effect.type === 'burn' || effect.type === 'acid' ? effect.type : 'degeneration'
      applyEcsCapturedDamage(world, {
        attribution: getStatusDamageAttribution(world, entityId, effect) ?? { sourceExternalId: sourceId },
        attack: 0,
        modifiers: { attackBoostValue: 0, outputSuppression: 0, accuracyPenalty: 0, accuracyPenaltyResist: 0, armorPierceRatio: 0, summonCounterDamageMult: 1, shieldDamageMult: 1, lifestealMult: 0, executeThreshold: 0 },
      }, entityId, damage, actions, { defensePolicy: 'bypass_all', allowMinimumDamage: false, interceptable: false, deathCause: damageCause, originExternalId: `status:${externalId}:${getStatusStackIdentity(effect)}`, authoredOrdinal: 0, authoredPosition: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 }, statusType: effect.type, damageKind: 'dot' })
      actions.push({ unitId: sourceId, type: 'status_tick', targetId: externalId, statusType: effect.type, value: damage })
      return
    }
    vitality.hp -= damage
  actions.push({ unitId: sourceId, type: 'status_tick', targetId: externalId, statusType: effect.type, value: damage })
  actions.push({ unitId: sourceId, type: 'damage', targetId: externalId, damage, statusType: effect.type, damageKind: 'dot' })
  if (vitality.hp <= 0 && !vitality.isDead) {
    const cause = effect.type === 'burn' || effect.type === 'acid' ? effect.type : 'degeneration'
    const attribution = getStatusDamageAttribution(world, entityId, effect)
    onUnitDeath(entityId, attribution ?? world.sourceRefs.get(world, entityId, getStatusStackIdentity(effect)), cause)
  }
}

function getPeriodicDamage(maxHp: number, effect: StatusEffect): number {
  if (effect.type === 'burn') return Math.max(1, Math.floor(effect.value ?? 3))
  if (effect.type === 'acid') return Math.max(1, Math.floor(effect.value ?? maxHp * 0.02))
  if (effect.type !== 'degeneration') return 0
  if (effect.value === undefined) return Math.max(1, Math.floor(maxHp * 0.03))
  return Math.max(1, Math.floor(effect.value <= 1 ? maxHp * effect.value : effect.value))
}
