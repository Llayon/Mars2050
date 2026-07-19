import type { HackControlMode } from './combat.sim.types'

const HACK_CONTROL_PRIORITY: Record<HackControlMode, number> = {
  disable: 0,
  redirect: 1,
  confuse: 2,
}

export function normalizeHackControlMode(
  mode?: HackControlMode,
): HackControlMode | undefined {
  if (mode === 'disable' || mode === 'redirect' || mode === 'confuse') return mode
  return undefined
}

export function chooseHackControlMode(
  current?: HackControlMode,
  next?: HackControlMode,
): HackControlMode | undefined {
  if (!current) return next
  if (!next) return current
  return HACK_CONTROL_PRIORITY[next] > HACK_CONTROL_PRIORITY[current]
    ? next
    : current
}
