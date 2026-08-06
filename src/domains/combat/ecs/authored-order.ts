import type { AuthoredEffectPosition, DamageOrderKey } from './defense-batch'

export function compareAuthoredEffectPosition(left: AuthoredEffectPosition, right: AuthoredEffectPosition): number {
  return left.programIndex - right.programIndex ||
    left.groupIndex - right.groupIndex ||
    left.targetOrdinal - right.targetOrdinal ||
    left.effectIndex - right.effectIndex
}

export function compareDamageOrderStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function legacyAuthoredPosition(authoredOrdinal = 0): AuthoredEffectPosition {
  return { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: authoredOrdinal }
}

export function compareAuthoredKeys(left: DamageOrderKey, right: DamageOrderKey): number {
  return compareDamageOrderStrings(left.originExternalId, right.originExternalId) ||
    compareAuthoredEffectPosition(left.position ?? legacyAuthoredPosition(left.authoredOrdinal), right.position ?? legacyAuthoredPosition(right.authoredOrdinal)) ||
    compareDamageOrderStrings(left.targetExternalId, right.targetExternalId) ||
    compareDamageOrderStrings(left.sourceExternalId, right.sourceExternalId)
}
