import type { UnitTypeKey } from '@/domains/combat/combat.types'

export type UnitVisualAnimationKey = 'walk'

export interface UnitVisualAnimationConfig {
  path: string
  frameCount: number
  fps?: number
}

export interface UnitVisualConfig {
  scale?: number
  sourceCanvas?: number
  yOffset?: number
  anchor?: { x: number; y: number }
  hoverAmplitude?: number
  hoverSpeed?: number
  vfxScale?: number
  muzzleOffset?: number
  fxType?: string
  locomotion?: 'wheels' | 'tracks' | 'legs' | 'hover'
  recoilPx?: number
  trailColor?: number
  animations?: Partial<Record<UnitVisualAnimationKey, UnitVisualAnimationConfig>>
}

export const UNIT_VISUALS: Partial<Record<UnitTypeKey, UnitVisualConfig>> = {
  // SVG Units
  plasma_tank: { scale: 1.15, muzzleOffset: 45, fxType: 'fx_muzzle_cyan', vfxScale: 1.0 },
  missile_buggy: { scale: 1.0, muzzleOffset: 25, fxType: 'fx_impact_orange', vfxScale: 0.8, locomotion: 'wheels', recoilPx: 3, trailColor: 0x8b4513 },
  gunship: { scale: 1.1, yOffset: -30, hoverAmplitude: 4, hoverSpeed: 0.05, muzzleOffset: 40, fxType: 'fx_muzzle_orange', vfxScale: 1.2, locomotion: 'hover', recoilPx: 4, trailColor: 0x00ffff },
  engineer: { scale: 1.4 },
  emp_drone: { scale: 1.2, yOffset: -20, hoverAmplitude: 3, hoverSpeed: 0.08, muzzleOffset: 20, fxType: 'fx_muzzle_cyan', vfxScale: 0.7 },
  minelayer_rover: { scale: 1.1 },
  siege_tank: { scale: 1.2, muzzleOffset: 55, fxType: 'fx_muzzle_orange', vfxScale: 1.5, locomotion: 'tracks', recoilPx: 8, trailColor: 0xc05a30 },
  
  railgun_walker: { scale: 1.15, anchor: { x: 0.5, y: 0.7 }, muzzleOffset: 40, fxType: 'fx_muzzle_cyan', vfxScale: 1.3, locomotion: 'legs', recoilPx: 12 },
  drone_carrier: { scale: 1.2, yOffset: -25, hoverAmplitude: 2, hoverSpeed: 0.03 },
  cryo_tank: { scale: 1.15, muzzleOffset: 45, fxType: 'fx_muzzle_cyan', vfxScale: 1.0 },
  shield_emitter: { scale: 1.1 },
  interceptor: { scale: 1.1, yOffset: -35, hoverAmplitude: 5, hoverSpeed: 0.06, muzzleOffset: 30, fxType: 'fx_muzzle_orange', vfxScale: 0.9 },
  hacker_rover: { scale: 1.0 },

  artillery_crawler: { scale: 1.2, muzzleOffset: 60, fxType: 'fx_muzzle_orange', vfxScale: 1.4 },
  titan_mech: { scale: 1.3, anchor: { x: 0.5, y: 0.75 }, muzzleOffset: 70, fxType: 'fx_muzzle_orange', vfxScale: 1.8 },
  behemoth_tank: { scale: 1.2, muzzleOffset: 65, fxType: 'fx_muzzle_orange', vfxScale: 1.6 },
  ion_crawler: { scale: 1.15, muzzleOffset: 50, fxType: 'fx_muzzle_cyan', vfxScale: 1.2 },
  goliath_gunship: { scale: 1.25, yOffset: -40, hoverAmplitude: 3, hoverSpeed: 0.04, muzzleOffset: 55, fxType: 'fx_muzzle_cyan', vfxScale: 1.5 },
  mobile_factory: { scale: 1.1, anchor: { x: 0.5, y: 0.7 } },
  sonic_devastator: { scale: 1.15, muzzleOffset: 45, fxType: 'fx_muzzle_green', vfxScale: 1.3 },
  radar_zepplin: { scale: 1.1, yOffset: -45, hoverAmplitude: 4, hoverSpeed: 0.02 },

  stealth_operative: { scale: 1.5, muzzleOffset: 15, fxType: 'fx_muzzle_cyan', vfxScale: 0.6 },
  hologram_projector: { scale: 1.1 },
  gravity_manipulator: { scale: 1.15, yOffset: -10, hoverAmplitude: 2, hoverSpeed: 0.04, locomotion: 'hover' },
  nanite_generator: { scale: 1.1 },
  bounty_hunter: { scale: 1.4, muzzleOffset: 20, fxType: 'fx_muzzle_orange', vfxScale: 0.8 },

  // Old PNG units
  marine: { scale: 1.0, muzzleOffset: 15, fxType: 'fx_muzzle_orange', vfxScale: 0.5 },
  alien_bug: { scale: 1.0, muzzleOffset: 12, fxType: 'fx_impact_cyan', vfxScale: 0.6 },
  alien_spitter: { scale: 1.1, muzzleOffset: 18, fxType: 'fx_muzzle_green', vfxScale: 0.7 },
  rocketeer: { scale: 1.0, muzzleOffset: 18, fxType: 'fx_impact_orange', vfxScale: 0.8 },
  exosuit: { scale: 1.1, muzzleOffset: 25, fxType: 'fx_muzzle_orange', vfxScale: 1.0 },
  sniper: { scale: 1.0, muzzleOffset: 22, fxType: 'fx_muzzle_cyan', vfxScale: 0.6 },
  medic: { scale: 1.0 },
  turret: { scale: 1.1, muzzleOffset: 30, fxType: 'fx_muzzle_orange', vfxScale: 1.2 },
  flamethrower: { scale: 1.0, muzzleOffset: 20, fxType: 'fx_muzzle_orange', vfxScale: 1.0 }
}
