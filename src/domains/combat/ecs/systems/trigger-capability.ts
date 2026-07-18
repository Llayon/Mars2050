import type { RuntimeTriggerEffect, TriggerPayload } from '../../combat.sim.types'

const SUPPORTED_PAYLOADS = new Set<TriggerPayload['kind']>([
  'status',
  'shield',
  'heal',
  'spawn',
  'cooldown_reset',
])

export function isEcsTriggerSupported(trigger: RuntimeTriggerEffect): boolean {
  return SUPPORTED_PAYLOADS.has(trigger.payload.kind)
}
