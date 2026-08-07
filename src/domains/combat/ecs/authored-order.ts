import type { AuthoredEffectPosition, DamageOrderKey } from './defense-batch'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

export function compareAuthoredEffectPosition(left: AuthoredEffectPosition, right: AuthoredEffectPosition): number {
  return left.programIndex - right.programIndex ||
    left.groupIndex - right.groupIndex ||
    left.targetOrdinal - right.targetOrdinal ||
    left.effectIndex - right.effectIndex
}

export function compareDamageOrderStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function compareExternalIdsForMode(world: CombatWorld, left: string, right: string): number {
  return world.resources.get('defenseResolutionMode') === 'v9_snapshot'
    ? compareDamageOrderStrings(left, right)
    : left.localeCompare(right)
}

export function compareEntityExternalIdsForMode(world: CombatWorld, left: EntityId, right: EntityId): number {
  return compareExternalIdsForMode(
    world,
    world.stores.identity.require(left).id,
    world.stores.identity.require(right).id,
  )
}

export function legacyAuthoredPosition(authoredOrdinal = 0): AuthoredEffectPosition {
  return { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: authoredOrdinal }
}

export function compareAuthoredKeys(left: DamageOrderKey, right: DamageOrderKey): number {
  return compareDamageOrderStrings(left.originExternalId, right.originExternalId) ||
    compareAuthoredEffectPosition(left.position, right.position) ||
    compareDamageOrderStrings(left.targetExternalId, right.targetExternalId) ||
    compareDamageOrderStrings(left.sourceExternalId, right.sourceExternalId)
}
