import {
  chooseHackControlMode,
  normalizeHackControlMode,
} from './combat.control-mode'
import type {
  RuntimeStatusEffect,
  StatusEffect,
  StatusType,
} from './combat.sim.types'

export const HARMFUL_STATUS_TYPES: StatusType[] = [
  'emp',
  'slow',
  'burn',
  'acid',
  'vulnerable',
  'range_suppressed',
  'revealed',
  'hacked',
  'output_suppressed',
  'accuracy_reduced',
  'armor_broken',
  'degeneration',
]

export function normalizeStatusEffect(effect: StatusEffect): RuntimeStatusEffect {
  const periodic = ['burn', 'acid', 'degeneration', 'regen'].includes(effect.type)
  const tickInterval = periodic
    ? Math.max(1, Math.floor(effect.tickInterval ?? 10))
    : 0
  return {
    ...effect,
    duration: Math.max(0, Math.floor(effect.duration)),
    value: effect.value === undefined ? undefined : Number(effect.value),
    controlMode: normalizeHackControlMode(effect.controlMode),
    tickInterval,
    nextTickIn: tickInterval,
  }
}

export function getStatusStackIdentity(effect: StatusEffect): string {
  return `${effect.type}:${effect.stackKey ?? effect.sourceUnitId ?? 'global'}`
}

export function chooseStatusStrength(
  type: StatusType,
  current?: number,
  next?: number,
): number | undefined {
  if (current === undefined) return next
  if (next === undefined) return current
  if (type === 'slow' && current <= 1 && next <= 1) return Math.min(current, next)
  return Math.max(current, next)
}

export { chooseHackControlMode }
