import type { UnitTypeKey } from '@/domains/combat/combat.types'

export const REPLAY_SPRITE_ALIASES = {} as const satisfies Partial<Record<UnitTypeKey, UnitTypeKey>>

export const REPLAY_VISUAL_COVERAGE_EXEMPTIONS = [
  'wall',
] as const satisfies readonly UnitTypeKey[]

export const FORMER_REPLAY_ALIAS_UNITS = [
  'aa_turret',
  'drone',
  'scout_drone',
  'scavenger_buggy',
  'jetpack_trooper',
  'gatling_rover',
  'alien_worm',
] as const satisfies readonly UnitTypeKey[]

export const TIER1_DIRECT_VISUAL_UNITS = [
  'marine',
  'shock_trooper',
  'flamethrower',
  'medic',
  'sniper',
  'grenadier',
  'heavy_gunner',
  'sapper',
  'officer',
] as const satisfies readonly UnitTypeKey[]

export function getReplaySpriteAssetType(type: string): string {
  return (REPLAY_SPRITE_ALIASES as Record<string, string>)[type] ?? type
}

export function isReplayVisualCoverageExempt(type: string): boolean {
  return (REPLAY_VISUAL_COVERAGE_EXEMPTIONS as readonly string[]).includes(type)
}
