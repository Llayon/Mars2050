import type { BattleAction } from '../../combat.actions'
import type { RuntimeTriggerEffect, TriggerPayload } from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { captureLiveDamageSource, getDamageAttributionMetadata, type DamageAttribution } from '../damage-source'
import type { DamageOrderKey } from '../defense-batch'
import { compareEntityExternalIdsForMode } from '../authored-order'
import { applyEcsTriggerPayload } from './trigger-payload-system'

export function processEcsHpThresholdTriggers(
  world: CombatWorld,
  entityId: EntityId,
  actions: BattleAction[],
): void {
  const vitality = world.stores.vitality.require(entityId)
  for (const trigger of getTriggers(world, entityId, 'hp_threshold')) {
    const threshold = trigger.threshold ?? 0
    const value = threshold <= 1 ? vitality.hp / vitality.maxHp : vitality.hp
    if (value <= threshold) {
      fireEcsTrigger(world, entityId, trigger, entityId, entityId, actions)
    }
  }
}

export function processEcsKillTriggers(
  world: CombatWorld,
  killerId: EntityId,
  victimId: EntityId,
  actions: BattleAction[],
): void {
  for (const trigger of getTriggers(world, killerId, 'kill')) {
    fireEcsTrigger(world, killerId, trigger, victimId, killerId, actions)
  }
}

export function recordEcsAttackTriggers(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
): void {
  for (const trigger of getTriggers(world, sourceId, 'attack_count')) {
    trigger.counter++
    if (trigger.counter >= Math.max(1, trigger.count ?? 1)) {
      fireEcsTrigger(world, sourceId, trigger, targetId, sourceId, actions)
    }
  }
}

export function recordEcsDamageTakenTriggers(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  damage: number,
  actions: BattleAction[],
): void {
  if (damage <= 0) return
  for (const trigger of getTriggers(world, targetId, 'damage_taken')) {
    if (damage < Math.max(0, trigger.threshold ?? 0)) continue
    fireEcsTrigger(world, targetId, trigger, attackerId, attackerId, actions)
  }
}

export function recordEcsResolvedDamageTakenTriggers(
  world: CombatWorld,
  targetId: EntityId,
  attribution: DamageAttribution,
  damage: number,
  actions: BattleAction[],
): void {
  if (damage <= 0) return
  const attackerId = attribution.sourceEntityId ?? world.getEntityId(attribution.sourceExternalId)
  if (attackerId === undefined) return
  for (const trigger of getTriggers(world, targetId, 'damage_taken')) {
    if (damage < Math.max(0, trigger.threshold ?? 0)) continue
    fireEcsTrigger(world, targetId, trigger, attackerId, attackerId, actions, attribution)
  }
}

function getTriggers(
  world: CombatWorld,
  entityId: EntityId,
  event: RuntimeTriggerEffect['event'],
): RuntimeTriggerEffect[] {
  return (world.stores.lifecycle.require(entityId).triggerEffects ?? [])
    .filter(trigger => trigger.event === event)
}

export function fireEcsTrigger(
  world: CombatWorld,
  ownerId: EntityId,
  trigger: RuntimeTriggerEffect,
  eventTargetId: EntityId,
  actorId: EntityId | undefined,
  actions: BattleAction[],
  attribution?: DamageAttribution,
): void {
  if (!canFireTrigger(trigger)) return
  trigger.fired = true
  trigger.counter = 0
  trigger.cooldownRemaining = trigger.cooldownTicks ?? 0
  if (trigger.triggersRemaining !== undefined) trigger.triggersRemaining--

  const targetId = resolveTarget(world, ownerId, eventTargetId, actorId, trigger.payload)
  actions.push({
    unitId: getExternalId(world, ownerId),
    type: 'trigger_effect',
    targetId: targetId === null ? undefined : getExternalId(world, targetId),
    statusType: trigger.id,
    ...(attribution ? { sourceUnitId: attribution.sourceExternalId, ...getDamageAttributionMetadata(world, attribution) } : {}),
  })
  if (world.resources.get('defenseResolutionMode') === 'v9_snapshot' && !world.resources.get('actionGroup')?.active) {
    const ownerExternalId = getExternalId(world, ownerId)
    const targetExternalId = targetId === null ? getExternalId(world, eventTargetId) : getExternalId(world, targetId)
    const sourceExternalId = actorId === undefined ? ownerExternalId : getExternalId(world, actorId)
    const order: DamageOrderKey = {
      originExternalId: `trigger:${ownerExternalId}:${trigger.id}`,
      position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 },
      targetExternalId,
      sourceExternalId,
    }
    const queue = world.resources.get('v9FollowUps') ?? []
    world.resources.set('v9FollowUps', queue)
    const eventTargetExternalId = getExternalId(world, eventTargetId)
    const capturedAttribution = trigger.event === 'damage_taken'
      ? captureTriggerOwnerAttribution(world, ownerId)
      : attribution ?? captureTriggerOwnerAttribution(world, ownerId)
    const capturedSource = captureLiveDamageSource(world, ownerId)
    queue.push({
      ownerExternalId,
      targetExternalId: targetId === null ? undefined : getExternalId(world, targetId),
      eventTargetExternalId,
      payload: structuredClone(trigger.payload), actions,
      parentGroupKey: world.resources.get('actionGroup')?.groupKey,
      followUpOrdinal: stableFollowUpOrdinal(order),
      order,
      attribution: structuredClone(capturedAttribution),
      capturedSource: structuredClone(capturedSource),
      chainPath: [order.originExternalId],
    })
    return
  }
  applyEcsTriggerPayload(
    world,
    ownerId,
    targetId,
    eventTargetId,
    trigger.payload,
    actions,
  )
}

function captureTriggerOwnerAttribution(world: CombatWorld, ownerId: EntityId): DamageAttribution {
  const identity = world.stores.identity.require(ownerId)
  return { sourceExternalId: identity.id, sourceEntityId: ownerId, sourceUnitType: identity.type, sourceTeam: identity.team }
}

function stableFollowUpOrdinal(order: DamageOrderKey): number {
  const value = `${order.originExternalId}\u0000${order.position.programIndex}\u0000${order.position.groupIndex}\u0000${order.position.targetOrdinal}\u0000${order.position.effectIndex}\u0000${order.targetExternalId}\u0000${order.sourceExternalId}`
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return hash >>> 0
}

function canFireTrigger(trigger: RuntimeTriggerEffect): boolean {
  if (trigger.cooldownRemaining > 0) return false
  if (!trigger.repeatable && trigger.fired) return false
  return trigger.triggersRemaining === undefined || trigger.triggersRemaining > 0
}

function resolveTarget(
  world: CombatWorld,
  ownerId: EntityId,
  eventTargetId: EntityId,
  actorId: EntityId | undefined,
  payload: TriggerPayload,
): EntityId | null {
  if (payload.target === 'self') return ownerId
  if (payload.target === 'target' || payload.target === 'victim') return eventTargetId
  if (payload.target === 'attacker' || payload.target === 'killer') return actorId ?? null
  return selectNearestEnemy(world, ownerId)
}

function selectNearestEnemy(world: CombatWorld, ownerId: EntityId): EntityId | null {
  const owner = world.stores.transform.require(ownerId)
  const team = world.stores.identity.require(ownerId).team
  let selected: EntityId | null = null
  let selectedDistance = Number.POSITIVE_INFINITY
  for (const entityId of world.query(['identity', 'transform', 'vitality'])) {
    if (world.stores.identity.require(entityId).team === team) continue
    if (world.stores.vitality.require(entityId).isDead) continue
    const target = world.stores.transform.require(entityId)
    const distance = getDistance(owner.x, owner.y, target.x, target.y)
    if (distance < selectedDistance || distance === selectedDistance && selected !== null && compareEntityExternalIdsForMode(world, entityId, selected) < 0) {
      selected = entityId
      selectedDistance = distance
    }
  }
  return selected
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.identity.require(entityId).id
}
