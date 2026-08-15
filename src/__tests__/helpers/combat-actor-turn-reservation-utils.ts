import type { EcsActionKind } from '@/domains/combat/combat.action-intent'
import type { CombatWorld } from '@/domains/combat/ecs/combat-world'
import type { EntityId } from '@/domains/combat/ecs/entity'
import type { MovementRequest } from '@/domains/combat/ecs/movement-batch.types'
import type { ActorStateView } from './combat-actor-turn-reservation-types'
import type { OrderingProbeResult } from './combat-ordering-probes'

export function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function semanticId(world: CombatWorld, entityId: EntityId, probe: OrderingProbeResult): string {
  const externalId = world.stores.identity.require(entityId).id
  const identity = probe.semanticByExternalId.get(externalId)
  if (!identity) throw new Error(`MISSING_SEMANTIC_IDENTITY:${externalId}`)
  return `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}`
}

export function getActionKind(world: CombatWorld, entityId: EntityId): EcsActionKind {
  const weapon = world.stores.weapon.require(entityId)
  if (weapon.attackType === 'heal') return 'heal'
  if (weapon.attackType === 'spawn') return 'spawn'
  if (world.stores.runtimeRules.require(entityId).mineOnAction) return 'mine'
  if (weapon.smokeOnAction) return 'smoke'
  return 'weapon'
}

export function canActOnTarget(world: CombatWorld, entityId: EntityId, targetId: EntityId): boolean {
  const source = world.stores.identity.require(entityId)
  const target = world.stores.identity.require(targetId)
  if (source.team !== target.team) return true
  if (world.stores.weapon.require(entityId).attackType === 'heal') return true
  return world.stores.statusControl.require(entityId).statusEffects.some(effect =>
    effect.type === 'hacked' && effect.duration > 0 && (effect.controlMode === 'redirect' || effect.controlMode === 'confuse'))
}

export function getSlot(state: ActorStateView): number | null {
  const value = state.targeting.meleeSlotIndex
  return typeof value === 'number' ? value : null
}

export function getTarget(value: Record<string, unknown>, field: string): string | null {
  const target = value[field]
  return typeof target === 'string' ? target : null
}

export function describeMovementRequest(world: CombatWorld, request: MovementRequest, probe: OrderingProbeResult): Record<string, unknown> {
  return request.kind === 'turn'
    ? { kind: request.kind, semanticActor: semanticId(world, request.entityId, probe), targetX: request.targetX, targetY: request.targetY, initiativeIndex: request.initiativeIndex }
    : { kind: request.kind, semanticActor: semanticId(world, request.entityId, probe), semanticTarget: semanticId(world, request.targetId, probe), initiativeIndex: request.initiativeIndex }
}
