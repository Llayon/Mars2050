import type { BattleAction } from '../../combat.actions'
import { chooseHackControlMode } from '../../combat.control-mode'
import type { RuntimeStatusEffect, StatusEffect } from '../../combat.primitives'
import {
  HARMFUL_STATUS_TYPES,
  chooseStatusStrength,
  getStatusStackIdentity,
  normalizeStatusEffect,
} from '../../combat.status-core'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { DamageOrderKey } from '../defense-batch'

export function applyEcsStatus(
  world: CombatWorld,
  targetId: EntityId,
  effect: StatusEffect,
  actions: BattleAction[],
  authoredKey?: DamageOrderKey,
): boolean {
  const actionGroup = world.resources.get('actionGroup')
  if (actionGroup?.active && !actionGroup.committing) {
    const normalized = normalizeStatusEffect(effect)
    if (normalized.duration <= 0) return false
    const statuses = world.stores.statusControl.require(targetId).statusEffects
    if (isBlockedByImmunity(statuses, normalized)) {
      actions.push({ unitId: world.stores.identity.require(targetId).id, type: 'status_immune', statusType: normalized.type })
      return false
    }
    actionGroup.queueStatus(targetId, normalized, authoredKey)
    return true
  }
  const identity = world.stores.identity.require(targetId)
  const statuses = world.stores.statusControl.require(targetId).statusEffects
  const normalized = normalizeStatusEffect(effect)
  if (normalized.duration <= 0) return false
  if (isBlockedByImmunity(statuses, normalized)) {
    actions.push({ unitId: identity.id, type: 'status_immune', statusType: normalized.type })
    return false
  }
  const existing = statuses.find(status =>
    getStatusStackIdentity(status) === getStatusStackIdentity(normalized),
  )
  if (existing) refreshStatus(existing, normalized)
  else {
    statuses.push(normalized)
    world.setUnitCapability(targetId, 'activeStatusCapability', true)
  }
  world.sourceRefs.setExternal(
    world,
    targetId,
    getStatusStackIdentity(existing ?? normalized),
    normalized.sourceUnitId,
  )
  const action: BattleAction = {
    unitId: identity.id,
    type: 'status_apply',
    statusType: normalized.type,
    value: normalized.value,
  }
  if (normalized.controlMode !== undefined) action.controlMode = normalized.controlMode
  actions.push(action)
  if (normalized.type === 'revealed') breakRevealStates(world, targetId, actions)
  return !existing
}

function isBlockedByImmunity(
  statuses: RuntimeStatusEffect[],
  effect: RuntimeStatusEffect,
): boolean {
  if (effect.type === 'status_immunity' || !HARMFUL_STATUS_TYPES.includes(effect.type)) return false
  return statuses.some(status => status.type === 'status_immunity' && status.duration > 0)
}

function refreshStatus(existing: RuntimeStatusEffect, next: RuntimeStatusEffect): void {
  existing.duration = Math.max(existing.duration, next.duration)
  existing.value = chooseStatusStrength(existing.type, existing.value, next.value)
  existing.controlMode = chooseHackControlMode(existing.controlMode, next.controlMode)
}

function breakRevealStates(
  world: CombatWorld,
  targetId: EntityId,
  actions: BattleAction[],
): void {
  const identity = world.stores.identity.require(targetId)
  const movement = world.stores.movement.require(targetId)
  if (movement.isBurrowed) {
    movement.isBurrowed = false
    actions.push({ unitId: identity.id, type: 'burrow_change', value: 0 })
  }
  if (movement.movementStealthActive) {
    movement.movementStealthActive = false
    actions.push({ unitId: identity.id, type: 'stealth_change', modeState: 'movement_inactive' })
  }
}
