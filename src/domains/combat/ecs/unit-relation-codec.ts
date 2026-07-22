import type { SimUnit } from '../combat.sim.types'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

export interface PendingUnitRelations {
  attackTargetId?: string
  rampTargetId?: string
  meleeSlotTargetId?: string
  meleeWaitingTargetId?: string
  lastProgressTargetId?: string
  summonOwnerId?: string
}

export function captureUnitRelations(unit: SimUnit): PendingUnitRelations {
  return {
    attackTargetId: unit.attackTargetId,
    rampTargetId: unit.rampTargetId,
    meleeSlotTargetId: unit.meleeSlotTargetId,
    meleeWaitingTargetId: unit.meleeWaitingTargetId,
    lastProgressTargetId: unit.lastProgressTargetId,
    summonOwnerId: unit.summonOwnerId,
  }
}

export function resolveUnitRelations(
  world: CombatWorld,
  entityId: EntityId,
  pending: PendingUnitRelations,
): boolean {
  const refs = world.stores.entityTargets.require(entityId)
  let complete = true
  complete = resolvePending(world, pending, 'attackTargetId', value => { refs.attackTarget = value }) && complete
  complete = resolvePending(world, pending, 'rampTargetId', value => { refs.rampTarget = value }) && complete
  complete = resolvePending(world, pending, 'meleeSlotTargetId', value => { refs.meleeTarget = value }) && complete
  complete = resolvePending(world, pending, 'meleeWaitingTargetId', value => { refs.meleeWaitingTarget = value }) && complete
  complete = resolvePending(world, pending, 'lastProgressTargetId', value => { refs.progressTarget = value }) && complete
  complete = resolvePending(world, pending, 'summonOwnerId', value => {
    world.linkSummonOwner(entityId, value)
  }) && complete
  return complete
}

export function serializeUnitRelations(
  world: CombatWorld,
  entityId: EntityId,
  pending?: PendingUnitRelations,
): PendingUnitRelations {
  const refs = world.stores.entityTargets.require(entityId)
  return {
    attackTargetId: externalId(world, refs.attackTarget) ?? pending?.attackTargetId,
    rampTargetId: externalId(world, refs.rampTarget) ?? pending?.rampTargetId,
    meleeSlotTargetId: externalId(world, refs.meleeTarget) ?? pending?.meleeSlotTargetId,
    meleeWaitingTargetId: externalId(world, refs.meleeWaitingTarget) ?? pending?.meleeWaitingTargetId,
    lastProgressTargetId: externalId(world, refs.progressTarget) ?? pending?.lastProgressTargetId,
    summonOwnerId: externalId(world, refs.summonOwner) ?? pending?.summonOwnerId,
  }
}

function resolvePending(
  world: CombatWorld,
  pending: PendingUnitRelations,
  field: keyof PendingUnitRelations,
  assign: (entityId: EntityId) => void,
): boolean {
  const externalId = pending[field]
  if (externalId === undefined) return true
  const entityId = world.getEntityId(externalId)
  if (entityId === undefined) return false
  assign(entityId)
  pending[field] = undefined
  return true
}

function externalId(world: CombatWorld, entityId: EntityId | undefined): string | undefined {
  return entityId === undefined
    ? undefined
    : world.stores.entityMeta.get(entityId)?.externalId
}
