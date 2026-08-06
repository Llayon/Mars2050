import type { BattleAction } from '../../combat.actions'
import type { RuntimeTriggerEffect, TriggerPayload } from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getDamageAttributionMetadata, type DamageAttribution } from '../damage-source'
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
    world.resources.require('v9FollowUps').push({ ownerId, targetId, eventTargetId, payload: trigger.payload, actions })
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
    const target = world.stores.transform.require(entityId)
    const distance = getDistance(owner.x, owner.y, target.x, target.y)
    if (distance < selectedDistance) {
      selected = entityId
      selectedDistance = distance
    }
  }
  return selected
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.identity.require(entityId).id
}
