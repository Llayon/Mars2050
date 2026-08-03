import type { UnitTypeKey } from './combat.types'

export const TIER1_UNIT_TYPES = [
  'marine',
  'shock_trooper',
  'flamethrower',
  'scout_drone',
  'medic',
  'sniper',
  'scavenger_buggy',
  'grenadier',
  'heavy_gunner',
  'explosive_drone',
  'light_walker',
  'jetpack_trooper',
] as const satisfies readonly UnitTypeKey[]

export type Tier1UnitType = (typeof TIER1_UNIT_TYPES)[number]

export const TIER1_COMMAND_RULES = {
  minLimit: 3,
  maxLimit: 12,
  defaultLimit: 6,
} as const

export const TIER1_COMMAND_COSTS: Record<Tier1UnitType, 1> = {
  marine: 1,
  shock_trooper: 1,
  flamethrower: 1,
  scout_drone: 1,
  medic: 1,
  sniper: 1,
  scavenger_buggy: 1,
  grenadier: 1,
  heavy_gunner: 1,
  explosive_drone: 1,
  light_walker: 1,
  jetpack_trooper: 1,
}

export function isTier1UnitType(unitType: UnitTypeKey): unitType is Tier1UnitType {
  return TIER1_UNIT_TYPES.some(candidate => candidate === unitType)
}

export function getTier1CommandCost(unitType: UnitTypeKey): number | null {
  return isTier1UnitType(unitType) ? TIER1_COMMAND_COSTS[unitType] : null
}
