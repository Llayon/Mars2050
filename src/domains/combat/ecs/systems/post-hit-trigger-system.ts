import type { BattleAction } from '../../combat.actions'
import type { RuntimeTriggerEffect, TriggerPayload } from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsHealing } from './healing-system'
import { applyEcsStatus } from './status-application-system'

const SUPPORTED_EVENTS = new Set<RuntimeTriggerEffect['event']>([
  'attack_count',
  'damage_taken',
])
const SUPPORTED_PAYLOADS = new Set<TriggerPayload['kind']>([
  'status',
  'shield',
  'heal',
  'cooldown_reset',
])

export function canUseEcsPostHitTriggers(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
): boolean {
  return [attackerId, targetId].every(entityId =>
    (world.stores.lifecycle.require(entityId).triggerEffects ?? []).every(trigger =>
      SUPPORTED_EVENTS.has(trigger.event) && SUPPORTED_PAYLOADS.has(trigger.payload.kind),
    ),
  )
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
      fireTrigger(world, sourceId, trigger, targetId, sourceId, actions)
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
    fireTrigger(world, targetId, trigger, attackerId, attackerId, actions)
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

function fireTrigger(
  world: CombatWorld,
  ownerId: EntityId,
  trigger: RuntimeTriggerEffect,
  eventTargetId: EntityId,
  actorId: EntityId,
  actions: BattleAction[],
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
  })
  applyPayload(world, ownerId, targetId, eventTargetId, trigger.payload, actions)
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
  actorId: EntityId,
  payload: TriggerPayload,
): EntityId | null {
  if (payload.target === 'self') return ownerId
  if (payload.target === 'target' || payload.target === 'victim') return eventTargetId
  if (payload.target === 'attacker' || payload.target === 'killer') return actorId
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

function applyPayload(
  world: CombatWorld,
  ownerId: EntityId,
  targetId: EntityId | null,
  eventTargetId: EntityId,
  payload: TriggerPayload,
  actions: BattleAction[],
): void {
  if (targetId === null) return
  if (payload.kind === 'status') {
    applyEcsStatus(world, targetId, {
      ...payload.status,
      sourceUnitId: getExternalId(world, ownerId),
    }, actions)
  } else if (payload.kind === 'shield') {
    applyShield(world, ownerId, targetId, payload.amount, actions)
  } else if (payload.kind === 'heal') {
    applyEcsHealing(
      world,
      ownerId,
      targetId,
      getHealAmount(world, targetId, eventTargetId, payload),
      actions,
    )
  } else if (payload.kind === 'cooldown_reset') {
    world.stores.combat.require(targetId).actionCooldown = 0
  }
  world.syncComponentsFromStore(targetId, [
    'vitality',
    'combat',
    'statusControl',
    'movement',
  ])
}

function applyShield(
  world: CombatWorld,
  ownerId: EntityId,
  targetId: EntityId,
  requestedAmount: number,
  actions: BattleAction[],
): void {
  const amount = Math.max(0, Math.floor(requestedAmount))
  const vitality = world.stores.vitality.require(targetId)
  vitality.maxShield = Math.max(vitality.maxShield, vitality.shield + amount)
  vitality.shield += amount
  actions.push({
    unitId: getExternalId(world, ownerId),
    type: 'shield_apply',
    targetId: getExternalId(world, targetId),
    damage: amount,
  })
}

function getHealAmount(
  world: CombatWorld,
  targetId: EntityId,
  eventTargetId: EntityId,
  payload: Extract<TriggerPayload, { kind: 'heal' }>,
): number {
  if (payload.amount !== undefined) return Math.max(0, Math.floor(payload.amount))
  if (payload.victimMaxHpPercent !== undefined) {
    return Math.max(1, Math.floor(
      world.stores.vitality.require(eventTargetId).maxHp * payload.victimMaxHpPercent,
    ))
  }
  return Math.max(1, Math.floor(
    world.stores.vitality.require(targetId).maxHp * (payload.percentMaxHp ?? 0),
  ))
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.identity.require(entityId).id
}
