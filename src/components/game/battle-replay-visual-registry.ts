import type { UnitTypeKey } from '@/domains/combat/combat.types'
import type {
  ReplayVisualClip,
  ReplayVisualDirection,
} from './battle-replay-canvas-types'

export type ReplayVisualAssetKind = 'png' | 'svg-strip' | 'atlas'

export interface ReplayVisualClipConfig {
  startFrame: number
  frameCount: number
  fps: number
  loop?: boolean
  directionStride?: number
}

export interface ReplayVisualAsset {
  kind: ReplayVisualAssetKind
  path: string
  frameCount?: number
  sourceWidth?: number
  sourceHeight?: number
  atlasFrameCount?: number
  directionOrder?: readonly ReplayVisualDirection[]
  clips?: Partial<Record<ReplayVisualClip, ReplayVisualClipConfig>>
}

export const REPLAY_SPRITE_ALIASES = {} as const satisfies Partial<Record<UnitTypeKey, UnitTypeKey>>

export const REPLAY_VISUAL_COVERAGE_EXEMPTIONS = [
  'wall',
] as const satisfies readonly UnitTypeKey[]

export const REPLAY_SPRITE_DIRECTIONS = [
  'north',
  'south',
  'east',
  'west',
  'north-east',
  'north-west',
  'south-east',
  'south-west',
] as const satisfies readonly string[]

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

export const REPLAY_VISUAL_ASSETS = {
  marine: { kind: 'png', path: '/sprites/marine/rotations' },
  shock_trooper: { kind: 'png', path: '/assets/units/shock_trooper' },
  flamethrower: { kind: 'png', path: '/assets/units/flamethrower' },
  rocketeer: { kind: 'png', path: '/sprites/rocketeer' },
  exosuit: { kind: 'png', path: '/sprites/exosuit' },
  sniper: { kind: 'png', path: '/sprites/sniper' },
  medic: { kind: 'png', path: '/assets/units/medic-v2' },
  grenadier: { kind: 'png', path: '/assets/units/grenadier' },
  heavy_gunner: { kind: 'png', path: '/assets/units/heavy_gunner' },
  sapper: { kind: 'png', path: '/assets/units/sapper' },
  officer: { kind: 'png', path: '/assets/units/officer' },
  turret: { kind: 'png', path: '/sprites/turret' },
  alien_bug: { kind: 'png', path: '/sprites/alien_bug' },
  alien_spitter: { kind: 'png', path: '/sprites/alien_spitter' },
  aa_turret: { kind: 'svg-strip', path: '/assets/units/aa_turret_8dir.svg' },
  drone: { kind: 'svg-strip', path: '/assets/units/drone_8dir.svg' },
  alien_worm: { kind: 'svg-strip', path: '/assets/units/alien_worm_8dir.svg' },
  scout_drone: { kind: 'svg-strip', path: '/assets/units/scout_drone_8dir.svg' },
  explosive_drone: { kind: 'svg-strip', path: '/assets/units/drone_8dir.svg' },
  light_walker: { kind: 'svg-strip', path: '/assets/units/railgun_walker_8dir.svg' },
  scavenger_buggy: { kind: 'svg-strip', path: '/assets/units/scavenger_buggy_8dir.svg' },
  jetpack_trooper: { kind: 'svg-strip', path: '/assets/units/jetpack_trooper_8dir.svg' },
  gatling_rover: { kind: 'svg-strip', path: '/assets/units/gatling_rover_8dir.svg' },
  plasma_tank: { kind: 'svg-strip', path: '/assets/units/plasma_tank_8dir.svg' },
  missile_buggy: { kind: 'svg-strip', path: '/assets/units/missile_buggy_8dir.svg' },
  gunship: { kind: 'svg-strip', path: '/assets/units/gunship_8dir.svg' },
  engineer: { kind: 'svg-strip', path: '/assets/units/engineer_8dir.svg' },
  emp_drone: { kind: 'svg-strip', path: '/assets/units/emp_drone_8dir.svg' },
  minelayer_rover: { kind: 'svg-strip', path: '/assets/units/minelayer_rover_8dir.svg' },
  siege_tank: { kind: 'svg-strip', path: '/assets/units/siege_tank_8dir.svg' },
  railgun_walker: { kind: 'svg-strip', path: '/assets/units/railgun_walker_8dir.svg' },
  drone_carrier: { kind: 'svg-strip', path: '/assets/units/drone_carrier_8dir.svg' },
  cryo_tank: { kind: 'svg-strip', path: '/assets/units/cryo_tank_8dir.svg' },
  shield_emitter: { kind: 'svg-strip', path: '/assets/units/shield_emitter_8dir.svg' },
  interceptor: { kind: 'svg-strip', path: '/assets/units/interceptor_8dir.svg' },
  hacker_rover: { kind: 'svg-strip', path: '/assets/units/hacker_rover_8dir.svg' },
  artillery_crawler: { kind: 'svg-strip', path: '/assets/units/artillery_crawler_8dir.svg' },
  titan_mech: { kind: 'svg-strip', path: '/assets/units/titan_mech_8dir.svg' },
  behemoth_tank: { kind: 'svg-strip', path: '/assets/units/behemoth_tank_8dir.svg' },
  ion_crawler: { kind: 'svg-strip', path: '/assets/units/ion_crawler_8dir.svg' },
  goliath_gunship: { kind: 'svg-strip', path: '/assets/units/goliath_gunship_8dir.svg' },
  mobile_factory: { kind: 'svg-strip', path: '/assets/units/mobile_factory_8dir.svg' },
  sonic_devastator: { kind: 'svg-strip', path: '/assets/units/sonic_devastator_8dir.svg' },
  radar_zepplin: { kind: 'svg-strip', path: '/assets/units/radar_zepplin_8dir.svg' },
  stealth_operative: { kind: 'svg-strip', path: '/assets/units/stealth_operative_8dir.svg' },
  hologram_projector: { kind: 'svg-strip', path: '/assets/units/hologram_projector_8dir.svg' },
  gravity_manipulator: { kind: 'svg-strip', path: '/assets/units/gravity_manipulator_8dir.svg' },
  nanite_generator: { kind: 'svg-strip', path: '/assets/units/nanite_generator_8dir.svg' },
  bounty_hunter: { kind: 'svg-strip', path: '/assets/units/bounty_hunter_8dir.svg' },
} as const satisfies Partial<Record<UnitTypeKey, ReplayVisualAsset>>

const REPLAY_VISUAL_ASSET_ENTRIES = Object.entries(REPLAY_VISUAL_ASSETS) as [string, ReplayVisualAsset][]

export const SPRITE_DIRS: string[] = [...REPLAY_SPRITE_DIRECTIONS]

export const SPRITE_PATHS = Object.fromEntries(
  REPLAY_VISUAL_ASSET_ENTRIES
    .filter(([, asset]) => asset.kind === 'png')
    .map(([type, asset]) => [type, asset.path])
) as Record<string, string>

export const SVG_UNITS = REPLAY_VISUAL_ASSET_ENTRIES
  .filter(([, asset]) => asset.kind === 'svg-strip')
  .map(([type]) => type)

export const SPRITE_ATLASES = Object.fromEntries(
  REPLAY_VISUAL_ASSET_ENTRIES
    .filter(([, asset]) => asset.kind === 'atlas')
    .map(([type, asset]) => [type, asset.path])
) as Record<string, string>

export function getReplaySpriteAssetType(type: string): string {
  return (REPLAY_SPRITE_ALIASES as Record<string, string>)[type] ?? type
}

export function getReplayVisualAsset(type: string): { assetType: string, asset: ReplayVisualAsset } | null {
  const assetType = getReplaySpriteAssetType(type)
  const asset = (REPLAY_VISUAL_ASSETS as Partial<Record<string, ReplayVisualAsset>>)[assetType]
  return asset ? { assetType, asset } : null
}

export function getReplayVisualAssetPublicPaths(type: string): string[] {
  const resolved = getReplayVisualAsset(type)
  if (!resolved) return []
  const { asset } = resolved
  if (asset.kind === 'png') return REPLAY_SPRITE_DIRECTIONS.map(direction => `${asset.path}/${direction}.png`)
  if (asset.kind === 'atlas') return [asset.path.replace(/\.json$/, '.png')]
  return [asset.path]
}

export function isReplayVisualCoverageExempt(type: string): boolean {
  return (REPLAY_VISUAL_COVERAGE_EXEMPTIONS as readonly string[]).includes(type)
}
