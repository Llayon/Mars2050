import type { BattleAction } from '../../combat.actions'
import type {
  PercentHpDamageConfig,
  TriggerPayload,
} from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsCapturedDamage, applyEcsSingleDamage } from './damage-system'
import { getEcsGroupStartHp } from './damage-payload-system'
import { resolveEcsDeath } from './death-system'
import type { DamageOrderKey } from '../defense-batch'
import type { DamageAttribution, DamageSourceContext } from '../damage-source'
import { compareEntityExternalIdsForMode } from '../authored-order'

type DamagePayload = Extract<TriggerPayload, { kind: 'damage' }>

export function applyEcsTriggerDamage(
  world: CombatWorld,
  ownerId: EntityId | undefined,
  targetId: EntityId,
  payload: DamagePayload,
  actions: BattleAction[],
  authoredKey?: DamageOrderKey,
  capturedAttribution?: DamageAttribution,
  capturedSource?: DamageSourceContext,
): void {
  for (const [targetOrdinal, hitId] of getTargets(world, ownerId, targetId, payload.radius).entries()) {
    const percentDamage = getConfiguredDamage(world, hitId, payload.percentHp)
    if (percentDamage > 0) {
      actions.push({
        unitId: capturedAttribution?.sourceExternalId ?? (ownerId === undefined ? 'trigger' : world.stores.identity.require(ownerId).id),
        type: 'percent_hp_damage',
        targetId: world.stores.identity.require(hitId).id,
        value: percentDamage,
      })
    }
    const options = {
      allowPercentHpDamage: false,
      deathCause: 'trigger' as const,
      interceptable: false,
      originExternalId: authoredKey?.originExternalId ?? `trigger:${capturedAttribution?.sourceExternalId ?? (ownerId === undefined ? 'unknown' : world.stores.identity.require(ownerId).id)}`,
      authoredOrdinal: targetOrdinal,
      authoredPosition: authoredKey ? { ...authoredKey.position, targetOrdinal } : { programIndex: 0, groupIndex: 0, targetOrdinal, effectIndex: 0 },
    }
    const result = capturedAttribution || capturedSource
      ? applyCapturedTriggerDamage(world, capturedAttribution ?? capturedSource!.attribution, hitId, Math.max(0, Math.floor(payload.amount ?? 0)) + percentDamage, actions, options, capturedSource)
      : applyEcsSingleDamage(world, ownerId!, hitId, Math.max(0, Math.floor(payload.amount ?? 0)) + percentDamage, actions, options)
    if (!result.intercepted) resolveEcsDeath(world, hitId, capturedAttribution ?? ownerId, actions, 'trigger')
  }
}

function applyCapturedTriggerDamage(
  world: CombatWorld,
  attribution: DamageAttribution,
  targetId: EntityId,
  amount: number,
  actions: BattleAction[],
  options: Parameters<typeof applyEcsSingleDamage>[5],
  capturedSource?: DamageSourceContext,
): ReturnType<typeof applyEcsSingleDamage> {
  const source: DamageSourceContext = capturedSource
    ? { ...structuredClone(capturedSource), attribution: structuredClone(attribution) }
    : {
      attribution,
      attack: 0,
      modifiers: {
        attackBoostValue: 0,
        outputSuppression: 0,
        accuracyPenalty: 0,
        accuracyPenaltyResist: 0,
        armorPierceRatio: 0,
        summonCounterDamageMult: 1,
        shieldDamageMult: 1,
        lifestealMult: 0,
        executeThreshold: 0,
      },
    }
  return applyEcsCapturedDamage(world, source, targetId, amount, actions, options)
}

function getTargets(
  world: CombatWorld,
  ownerId: EntityId | undefined,
  targetId: EntityId,
  radius: number | undefined,
): EntityId[] {
  if (radius === undefined || ownerId === undefined) return [targetId]
  const target = world.stores.transform.require(targetId)
  const ownerTeam = world.stores.identity.require(ownerId).team
  const spatial = world.resources.get('entitySpatial')
  const candidates = spatial
    ? spatial.query(world, target.x, target.y, radius)
    : world.query(['identity', 'transform', 'vitality'])
  return candidates
    .filter(entityId => {
      if (world.stores.identity.require(entityId).team === ownerTeam) return false
      const candidate = world.stores.transform.require(entityId)
      return getDistance(target.x, target.y, candidate.x, candidate.y) <= radius
    })
    .sort((left, right) => compareEntityExternalIdsForMode(world, left, right))
}

function getConfiguredDamage(
  world: CombatWorld,
  targetId: EntityId,
  config: PercentHpDamageConfig | undefined,
): number {
  if (!config) return 0
  const vitality = world.stores.vitality.require(targetId)
  const basis = (config.basis ?? 'max') === 'current'
    ? getEcsGroupStartHp(world, targetId) ?? vitality.hp
    : vitality.maxHp
  let damage = Math.max(0, Math.floor(basis * config.percent))
  if (config.minBonus !== undefined) {
    damage = Math.max(damage, Math.floor(config.minBonus))
  }
  if (config.maxBonus !== undefined) {
    damage = Math.min(damage, Math.floor(config.maxBonus))
  }
  return Math.max(0, damage)
}
