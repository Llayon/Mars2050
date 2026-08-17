import type { TerrainBiome } from './mars-terrain.types'

/**
 * Authoritative color palette for Martian surface formations and ground shading.
 */
export interface TerrainGroundColor {
  base: number
  shadow: number
  highlight: number
  rgb: [number, number, number]
}

/**
 * Hex to normalized RGB tuple [0..1, 0..1, 0..1].
 */
export function hexToRgbTuple(hex: number): [number, number, number] {
  const r = ((hex >> 16) & 0xff) / 255
  const g = ((hex >> 8) & 0xff) / 255
  const b = (hex & 0xff) / 255
  return [r, g, b]
}

/**
 * Canonical color palette for the Martian geological strata.
 */
export const MARS_TERRAIN_PALETTE = {
  regolith: {
    base: 0x74301d,
    shadow: 0x5d2417,
    highlight: 0x8b3821,
    rgb: hexToRgbTuple(0x74301d)
  },
  oxide: {
    base: 0xa54525,
    shadow: 0x863319,
    highlight: 0xbd5830,
    rgb: hexToRgbTuple(0xa54525)
  },
  dust: {
    base: 0xc47b3b,
    shadow: 0xbb7048,
    highlight: 0xd09262,
    rgb: hexToRgbTuple(0xc47b3b)
  },
  basalt: {
    base: 0x27201e,
    shadow: 0x1d1715,
    highlight: 0x342723,
    rgb: hexToRgbTuple(0x27201e)
  },
  highlands: {
    base: 0x6e2b1b,
    shadow: 0x541e12,
    highlight: 0x883623,
    rgb: hexToRgbTuple(0x6e2b1b)
  },
  canyon: {
    base: 0x461d14,
    shadow: 0x30130d,
    highlight: 0x5c271b,
    rgb: hexToRgbTuple(0x461d14)
  }
} as const satisfies Record<string, TerrainGroundColor>

/**
 * Biome to ground tint mapping.
 */
export const BIOME_GROUND_COLORS: Record<TerrainBiome, TerrainGroundColor> = {
  regolith: MARS_TERRAIN_PALETTE.regolith,
  dust_basin: MARS_TERRAIN_PALETTE.dust,
  dunes: MARS_TERRAIN_PALETTE.dust,
  basalt: MARS_TERRAIN_PALETTE.basalt,
  highlands: MARS_TERRAIN_PALETTE.highlands,
  canyon: MARS_TERRAIN_PALETTE.canyon,
  polar: {
    base: 0xc0b8b0,
    shadow: 0x908880,
    highlight: 0xe0d8d0,
    rgb: hexToRgbTuple(0xc0b8b0)
  }
}

/**
 * Global geological flow defaults.
 */
export const TERRAIN_FLOW_DEFAULTS = {
  dominantAngleDeg: 35,
  streakScale: 0.0035,
  grainScale: 0.08,
  macroNoiseScale: 0.0012,
  mesoNoiseScale: 0.0048
} as const
