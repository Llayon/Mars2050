import type { SupportAura } from './combat.primitives'

/**
 * Checks if two support aura configs have identical properties.
 */
export function sameSupportAura(left: SupportAura, right: SupportAura): boolean {
  return (
    left.type === right.type &&
    left.radius === right.radius &&
    left.value === right.value &&
    left.duration === right.duration &&
    left.interval === right.interval &&
    left.target === right.target &&
    JSON.stringify(left.targetTags ?? []) === JSON.stringify(right.targetTags ?? [])
  )
}
