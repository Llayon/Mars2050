import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

/**
 * Neutral mutation gateway for combat defensive resources (ADR-014).
 * Runtime systems must use this module instead of mutating shield, barrier,
 * shield-hit-block, or reactive-armor state directly.
 */
export function setShield(world: CombatWorld, entityId: EntityId, value: number): number {
  const vitality = world.stores.vitality.require(entityId)
  const next = Math.max(0, Math.min(vitality.maxShield ?? Number.POSITIVE_INFINITY, value))
  vitality.shield = next
  return next
}

export function addShield(world: CombatWorld, entityId: EntityId, amount: number): number {
  const vitality = world.stores.vitality.require(entityId)
  return setShield(world, entityId, vitality.shield + Math.max(0, amount))
}

export function increaseShieldCapacity(world: CombatWorld, entityId: EntityId, amount: number): number {
  const vitality = world.stores.vitality.require(entityId)
  const increment = Math.max(0, amount)
  const group = world.resources.get('actionGroup')
  if (world.resources.get('defenseResolutionMode') === 'v9_snapshot' && group?.active && !group.committing) {
    group.queueDefenseGrant(entityId, increment, world.stores.identity.require(entityId).id, 'shield_capacity')
    return vitality.maxShield + increment
  }
  vitality.maxShield += increment
  return grantShield(world, entityId, increment)
}

export function setShieldCapacity(world: CombatWorld, entityId: EntityId, capacity: number): number {
  const vitality = world.stores.vitality.require(entityId)
  vitality.maxShield = Math.max(0, capacity)
  return setShield(world, entityId, vitality.shield)
}

export function consumeShieldHitBlockCharge(world: CombatWorld, entityId: EntityId): boolean {
  const defense = world.stores.defense.require(entityId)
  const charges = Math.max(0, defense.shieldHitBlockCharges ?? 0)
  if (charges === 0) return false
  defense.shieldHitBlockCharges = charges - 1
  return true
}

export function consumeReactiveArmorCharge(world: CombatWorld, entityId: EntityId): boolean {
  const defense = world.stores.defense.require(entityId)
  const charges = Math.max(0, defense.reactiveArmorCharges ?? 0)
  if (charges === 0) return false
  defense.reactiveArmorCharges = charges - 1
  return true
}

export function setShieldHitBlockCharges(world: CombatWorld, entityId: EntityId, value: number): number {
  const defense = world.stores.defense.require(entityId)
  defense.shieldHitBlockCharges = Math.max(0, value)
  return defense.shieldHitBlockCharges
}

export function setReactiveArmorCharges(world: CombatWorld, entityId: EntityId, value: number): number {
  const defense = world.stores.defense.require(entityId)
  defense.reactiveArmorCharges = Math.max(0, value)
  return defense.reactiveArmorCharges
}

export function grantShield(world: CombatWorld, entityId: EntityId, amount: number): number {
  const vitality = world.stores.vitality.require(entityId)
  const granted = Math.max(0, amount)
  const group = world.resources.get('actionGroup')
  if (world.resources.get('defenseResolutionMode') === 'v9_snapshot' && group?.active && !group.committing) {
    group.queueDefenseGrant(entityId, granted, world.stores.identity.require(entityId).id, 'shield')
    return vitality.shield + granted
  }
  vitality.maxShield = Math.max(vitality.maxShield, vitality.shield + granted)
  return setShield(world, entityId, vitality.shield + granted)
}

export function setBarrierCapacity(world: CombatWorld, entityId: EntityId, value: number): number {
  const barrier = world.stores.hazard.require(entityId)
  const next = Math.max(0, Math.min(barrier.maxCapacity ?? Number.POSITIVE_INFINITY, value))
  barrier.capacity = next
  return next
}

export function consumeBarrierCapacity(world: CombatWorld, entityId: EntityId, amount: number): number {
  const barrier = world.stores.hazard.require(entityId)
  const current = Math.max(0, barrier.capacity ?? 0)
  const consumed = Math.min(current, Math.max(0, amount))
  barrier.capacity = current - consumed
  return consumed
}

export function grantBarrier(world: CombatWorld, entityId: EntityId, amount: number): number {
  const barrier = world.stores.hazard.require(entityId)
  const group = world.resources.get('actionGroup')
  if (world.resources.get('defenseResolutionMode') === 'v9_snapshot' && group?.active && !group.committing) {
    group.queueDefenseGrant(entityId, amount, barrier.id, 'barrier_capacity')
    return (barrier.capacity ?? 0) + Math.max(0, amount)
  }
  return setBarrierCapacity(world, entityId, (barrier.capacity ?? 0) + Math.max(0, amount))
}

export function refreshBarrier(world: CombatWorld, entityId: EntityId, capacity: number, duration?: number): void {
  const barrier = world.stores.hazard.require(entityId)
  setBarrierCapacity(world, entityId, capacity)
  if (duration !== undefined) barrier.duration = Math.max(0, duration)
}

export function breakBarrier(world: CombatWorld, entityId: EntityId): void {
  const barrier = world.stores.hazard.require(entityId)
  barrier.capacity = 0
  barrier.duration = 0
}
