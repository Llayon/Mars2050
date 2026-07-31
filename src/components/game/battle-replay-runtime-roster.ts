import type { ReplayUnit } from './battle-replay-canvas-types'

export interface ReplayRuntimeRoster {
  units: Record<string, ReplayUnit>
  unitList: ReplayUnit[]
}

export function createReplayRuntimeRoster(): ReplayRuntimeRoster {
  return { units: {}, unitList: [] }
}

export function clearReplayRuntimeRoster(
  roster: ReplayRuntimeRoster,
): void {
  for (let index = 0; index < roster.unitList.length; index++) {
    delete roster.units[roster.unitList[index].id]
  }
  roster.unitList.length = 0
}

export function setReplayRuntimeUnit(
  roster: ReplayRuntimeRoster,
  unit: ReplayUnit,
): ReplayUnit {
  const current = roster.units[unit.id]
  if (current) {
    Object.assign(current, unit)
    return current
  }
  roster.units[unit.id] = unit
  roster.unitList.push(unit)
  return unit
}
