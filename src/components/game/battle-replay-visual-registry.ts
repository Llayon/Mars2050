import type { UnitTypeKey } from '@/domains/combat/combat.types'

export const REPLAY_SPRITE_ALIASES = {
  aa_turret: 'turret',
  drone: 'emp_drone',
  scout_drone: 'emp_drone',
  scavenger_buggy: 'missile_buggy',
  jetpack_trooper: 'interceptor',
  gatling_rover: 'missile_buggy',
  alien_worm: 'alien_spitter',
} as const satisfies Partial<Record<UnitTypeKey, UnitTypeKey>>

export const REPLAY_VISUAL_COVERAGE_EXEMPTIONS = [
  'wall',
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
