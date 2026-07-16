import type { BattleAction } from '../../combat.actions'
import type { DeathCause } from '../../combat.death'
import { chooseHackControlMode } from '../../combat.control'
import type { RuntimeStatusEffect, StatusEffect } from '../../combat.primitives'
import { HARMFUL_STATUS_TYPES, chooseStatusStrength, getStatusStackIdentity, normalizeStatusEffect } from '../../combat.status'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export type EcsHazardDeathHandler = (
  entityId: EntityId,
  sourceUnitId: string | undefined,
  cause: DeathCause,
) => void

export function runHazardSystem(
  world: CombatWorld,
  actions: BattleAction[],
  onUnitDeath: EcsHazardDeathHandler,
): void {
  const hazardIds = world.query(['entityMeta', 'hazard'], true).reverse()
  for (const hazardId of hazardIds) {
    const hazard = world.stores.hazard.get(hazardId)
    if (!hazard) continue
    hazard.duration--
    if (hazard.duration <= 0) {
      if (hazard.type === 'barrier_dome' && (hazard.capacity ?? 0) > 0) {
        actions.push({ unitId: hazard.sourceUnitId ?? hazard.id, type: 'barrier_expire', hazardId: hazard.id })
      }
      world.removeHazardEntity(hazardId)
      continue
    }
    if (hazard.type === 'mine') {
      if (processMine(world, hazardId, actions, onUnitDeath)) world.removeHazardEntity(hazardId)
      continue
    }
    if (hazard.type === 'smoke') {
      processSmoke(world, hazardId, actions)
      continue
    }
    if (hazard.damagePerTick > 0 && hazard.duration % 10 === 0) {
      for (const targetId of getTargetsInRadius(world, hazardId)) {
        const vitality = world.stores.vitality.require(targetId)
        vitality.hp -= hazard.damagePerTick
        actions.push(createDamageAction(world, hazardId, targetId))
        if (vitality.hp <= 0 && !vitality.isDead) onUnitDeath(targetId, hazard.sourceUnitId, 'hazard')
      }
    }
  }
}

function processMine(world: CombatWorld, hazardId: EntityId, actions: BattleAction[], onDeath: EcsHazardDeathHandler): boolean {
  const hazard = world.stores.hazard.require(hazardId)
  const targets = getTargetsInRadius(world, hazardId)
    .filter(entityId => world.stores.identity.require(entityId).team !== hazard.team)
    .sort((left, right) => getExternalId(world, left).localeCompare(getExternalId(world, right)))
  if (targets.length === 0) return false
  for (const targetId of targets) {
    const vitality = world.stores.vitality.require(targetId)
    vitality.hp -= hazard.damagePerTick
    actions.push(createDamageAction(world, hazardId, targetId))
    if (vitality.hp <= 0 && !vitality.isDead) onDeath(targetId, hazard.sourceUnitId, 'mine')
  }
  return true
}

function processSmoke(world: CombatWorld, hazardId: EntityId, actions: BattleAction[]): void {
  const hazard = world.stores.hazard.require(hazardId)
  if (hazard.duration % 10 !== 0 || !hazard.statusEffects?.length) return
  const targets = getTargetsInRadius(world, hazardId)
    .sort((left, right) => getExternalId(world, left).localeCompare(getExternalId(world, right)))
  for (const targetId of targets) {
    for (const effect of hazard.statusEffects) applyHazardStatus(world, targetId, { ...effect, sourceUnitId: hazard.id, stackKey: hazard.id }, actions)
  }
}

function getTargetsInRadius(world: CombatWorld, hazardId: EntityId): EntityId[] {
  const hazard = world.stores.hazard.require(hazardId)
  return world.resources.require('entitySpatial').query(world, hazard.x, hazard.y, hazard.radius).filter(entityId => {
    const transform = world.stores.transform.require(entityId)
    return !transform.isFlying
  })
}

function applyHazardStatus(world: CombatWorld, entityId: EntityId, effect: StatusEffect, actions: BattleAction[]): void {
  const identity = world.stores.identity.require(entityId)
  const statuses = world.stores.statusControl.require(entityId).statusEffects
  const normalized = normalizeStatusEffect(effect)
  if (normalized.duration <= 0) return
  if (normalized.type !== 'status_immunity' && HARMFUL_STATUS_TYPES.includes(normalized.type) && hasStatus(statuses, 'status_immunity')) {
    actions.push({ unitId: identity.id, type: 'status_immune', statusType: normalized.type })
    return
  }
  const existing = statuses.find(status => getStatusStackIdentity(status) === getStatusStackIdentity(normalized))
  if (existing) refreshStatus(existing, normalized)
  else statuses.push(normalized)
  actions.push({ unitId: identity.id, type: 'status_apply', statusType: normalized.type, value: normalized.value })
  if (normalized.type === 'revealed') breakRevealStates(world, entityId, actions)
}

function refreshStatus(existing: RuntimeStatusEffect, next: RuntimeStatusEffect): void {
  existing.duration = Math.max(existing.duration, next.duration)
  existing.value = chooseStatusStrength(existing.type, existing.value, next.value)
  existing.controlMode = chooseHackControlMode(existing.controlMode, next.controlMode)
}

function hasStatus(statuses: RuntimeStatusEffect[], type: RuntimeStatusEffect['type']): boolean {
  return statuses.some(status => status.type === type && status.duration > 0)
}

function breakRevealStates(world: CombatWorld, entityId: EntityId, actions: BattleAction[]): void {
  const identity = world.stores.identity.require(entityId)
  const movement = world.stores.movement.require(entityId)
  if (movement.isBurrowed) {
    movement.isBurrowed = false
    actions.push({ unitId: identity.id, type: 'burrow_change', value: 0 })
  }
  if (movement.movementStealthActive) {
    movement.movementStealthActive = false
    actions.push({ unitId: identity.id, type: 'stealth_change', modeState: 'movement_inactive' })
  }
}

function createDamageAction(world: CombatWorld, hazardId: EntityId, targetId: EntityId): BattleAction {
  const hazard = world.stores.hazard.require(hazardId)
  const action: BattleAction = { unitId: hazard.sourceUnitId ?? hazard.id, type: 'damage', targetId: getExternalId(world, targetId), damage: hazard.damagePerTick, hazardId: hazard.id, damageKind: 'hazard' }
  if (hazard.sourceUnitId) action.sourceUnitId = hazard.sourceUnitId
  return action
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.entityMeta.require(entityId).externalId
}
