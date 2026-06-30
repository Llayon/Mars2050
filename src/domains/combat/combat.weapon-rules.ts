import { UNIT_TYPES } from './combat.config'
import type { SimUnit } from './combat.sim.types'
import type { UnitTypeKey } from './combat.types'

const GRID_TO_PIXELS = 40

export function getMinimumActionRange(unit: SimUnit): number {
  return (UNIT_TYPES[unit.type as UnitTypeKey]?.baseStats.minimumRange ?? 0) * GRID_TO_PIXELS
}
