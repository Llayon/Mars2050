import type { BattleAction } from '../../combat.actions'
import type { TriggerPayload } from '../../combat.sim.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { DamageAttribution, DamageSourceContext } from '../damage-source'
import type { DamageOrderKey } from '../defense-batch'
import { grantShield } from '../defense-resource-commit'
import { applyEcsHealing } from './healing-system'
import { applyEcsStatus } from './status-application-system'
import { applyEcsTriggerDamage } from './trigger-damage-system'
import { applyEcsTriggerField } from './trigger-field-system'
import { startEcsTriggerReassembly } from './trigger-reassembly-system'
import { spawnEcsTriggerUnits } from './trigger-spawn-system'

export function applyEcsTriggerPayload(
  world: CombatWorld,
  ownerId: EntityId | undefined,
  targetId: EntityId | null,
  eventTargetId: EntityId | undefined,
  payload: TriggerPayload,
  actions: BattleAction[],
  authoredKey?: DamageOrderKey,
  capturedAttribution?: DamageAttribution,
  capturedSource?: DamageSourceContext,
): void {
  if (ownerId === undefined) {
    if (targetId === null) return
    if (payload.kind === 'status') {
      applyEcsStatus(world, targetId, {
        ...payload.status,
        sourceUnitId: capturedAttribution?.sourceExternalId ?? payload.status.sourceUnitId,
      }, actions, authoredKey, capturedAttribution)
    } else if (payload.kind === 'damage') {
      applyEcsTriggerDamage(world, undefined, targetId, payload, actions, authoredKey, capturedAttribution, capturedSource)
    }
    return
  }
  if (payload.kind === 'spawn') {
    const spawnTargetId = targetId ?? eventTargetId
    if (spawnTargetId !== undefined) spawnEcsTriggerUnits(world, ownerId, spawnTargetId, payload, actions)
    return
  }
  if (targetId === null) return
  if (payload.kind === 'field') {
    applyEcsTriggerField(world, ownerId, targetId, payload, actions)
    return
  }
  if (payload.kind === 'damage') {
    applyEcsTriggerDamage(world, ownerId, targetId, payload, actions, authoredKey, capturedAttribution, capturedSource)
    return
  }
  if (payload.kind === 'delayed_reassembly') {
    startEcsTriggerReassembly(world, ownerId, targetId, payload, actions)
    return
  }
  if (payload.kind === 'status') {
    applyEcsStatus(world, targetId, {
      ...payload.status,
      sourceUnitId: getExternalId(world, ownerId),
    }, actions, authoredKey)
  } else if (payload.kind === 'shield') {
    applyShield(world, ownerId, targetId, payload.amount, actions)
  } else if (payload.kind === 'heal') {
    const amount = getHealAmount(world, targetId, eventTargetId, payload)
    if (amount === undefined) return
    applyEcsHealing(
      world,
      ownerId,
      targetId,
      amount,
      actions,
    )
  } else if (payload.kind === 'cooldown_reset') {
    world.stores.combat.require(targetId).actionCooldown = 0
  }
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
    grantShield(world, targetId, amount)
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
  eventTargetId: EntityId | undefined,
  payload: Extract<TriggerPayload, { kind: 'heal' }>,
): number | undefined {
  if (payload.amount !== undefined) return Math.max(0, Math.floor(payload.amount))
  if (payload.victimMaxHpPercent !== undefined) {
    if (eventTargetId === undefined) return undefined
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
