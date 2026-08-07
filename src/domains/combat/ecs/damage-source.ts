import type { RankScalingConfig, RuntimeStatusEffect } from '../combat.primitives'
import type { PercentHpDamageConfig, Team } from '../combat.types'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { getStatusStackIdentity } from '../combat.status-core'

export interface DamageAttribution {
  sourceExternalId: string
  sourceUnitType?: string
  sourceTeam?: Team
  sourceEntityId?: EntityId
}

export interface DamageSourceModifiers {
  attackBoostValue: number
  outputSuppression: number
  accuracyPenalty: number
  accuracyPenaltyResist: number
  armorPierceRatio: number
  antiAirDamageMult?: number
  groundDamageMult?: number
  rank?: number
  rankScaling?: RankScalingConfig
  summonCounterDamageMult: number
  shieldDamageMult: number
  lifestealMult: number
  executeThreshold: number
  percentHpDamage?: PercentHpDamageConfig & { maxBonus: number }
}

export interface DamageSourceContext {
  attribution: DamageAttribution
  attack: number
  modifiers: DamageSourceModifiers
}

export function getDamageAttributionMetadata(
  world: CombatWorld,
  attribution: DamageAttribution,
): { sourceUnitType?: string; sourceTeam?: Team } {
  if (attribution.sourceEntityId !== undefined && world.stores.identity.get(attribution.sourceEntityId) !== undefined) return {}
  return {
    ...(attribution.sourceUnitType ? { sourceUnitType: attribution.sourceUnitType } : {}),
    ...(attribution.sourceTeam ? { sourceTeam: attribution.sourceTeam } : {}),
  }
}

export function captureLiveDamageSource(world: CombatWorld, sourceEntityId: EntityId): DamageSourceContext {
  const identity = world.stores.identity.require(sourceEntityId)
  const combat = world.stores.combat.require(sourceEntityId)
  const rules = world.stores.runtimeRules.require(sourceEntityId)
  const statuses = world.stores.statusControl.require(sourceEntityId).statusEffects
  return {
    attribution: {
      sourceExternalId: identity.id,
      sourceUnitType: identity.type,
      sourceTeam: identity.team,
      sourceEntityId,
    },
    attack: combat.attack,
    modifiers: {
      attackBoostValue: getStatusValue(statuses, 'attack_boost') ?? 0,
      outputSuppression: getOutputSuppression(statuses),
      accuracyPenalty: getStatusValue(statuses, 'accuracy_reduced') ?? 0,
      accuracyPenaltyResist: combat.accuracyPenaltyResist ?? 0,
      armorPierceRatio: combat.armorPierceRatio ?? 0,
      antiAirDamageMult: combat.antiAirDamageMult,
      groundDamageMult: combat.groundDamageMult,
      rank: identity.rank,
      rankScaling: combat.rankScaling ? structuredClone(combat.rankScaling) : undefined,
      summonCounterDamageMult: combat.summonCounterDamageMult ?? 1,
      shieldDamageMult: combat.shieldDamageMult ?? 1,
      lifestealMult: combat.lifestealMult ?? 0,
      executeThreshold: combat.executeThreshold ?? 0,
      percentHpDamage: rules.percentHpDamage ? structuredClone(rules.percentHpDamage) : undefined,
    },
  }
}

export function setStatusDamageAttribution(world: CombatWorld, targetId: EntityId, effect: RuntimeStatusEffect, attribution: DamageAttribution): void {
  const targetExternalId = world.stores.identity.require(targetId).id
  const map = world.resources.get('statusDamageAttribution') ?? new Map<string, DamageAttribution>()
  map.set(statusAttributionKey(targetExternalId, getStatusStackIdentity(effect)), structuredClone(attribution))
  world.resources.set('statusDamageAttribution', map)
}

export function getStatusDamageAttribution(world: CombatWorld, targetId: EntityId, effect: RuntimeStatusEffect): DamageAttribution | undefined {
  const targetExternalId = world.stores.identity.require(targetId).id
  return world.resources.get('statusDamageAttribution')?.get(statusAttributionKey(targetExternalId, getStatusStackIdentity(effect)))
}

export function clearStatusDamageAttribution(world: CombatWorld, targetId: EntityId, effect: RuntimeStatusEffect): void {
  const targetExternalId = world.stores.identity.require(targetId).id
  world.resources.get('statusDamageAttribution')?.delete(statusAttributionKey(targetExternalId, getStatusStackIdentity(effect)))
}

export function clearAllStatusDamageAttributions(world: CombatWorld, targetId: EntityId): void {
  const targetExternalId = world.stores.identity.require(targetId).id
  const prefix = `${targetExternalId}\u0000`
  const map = world.resources.get('statusDamageAttribution')
  if (!map) return
  for (const key of map.keys()) if (key.startsWith(prefix)) map.delete(key)
}

function statusAttributionKey(targetExternalId: string, stackIdentity: string): string {
  return `${targetExternalId}\u0000${stackIdentity}`
}

function getOutputSuppression(effects: RuntimeStatusEffect[]): number {
  const suppression = effects
    .filter(effect => effect.type === 'output_suppressed' && effect.duration > 0 && effect.value && effect.value > 0)
    .reduce((sum, effect) => sum + (effect.value! <= 1 ? effect.value! : effect.value! / 100), 0)
  return Math.min(0.5, suppression)
}

function getStatusValue(effects: RuntimeStatusEffect[], type: RuntimeStatusEffect['type']): number | undefined {
  let value: number | undefined
  for (const effect of effects) {
    if (effect.type !== type || effect.duration <= 0 || effect.value === undefined) continue
    value = value === undefined ? effect.value : Math.max(value, effect.value)
  }
  return value
}
