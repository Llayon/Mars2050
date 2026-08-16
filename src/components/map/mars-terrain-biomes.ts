import type { TerrainBiome } from './mars-terrain.types'

/**
 * Deterministic domain salts for 32-bit hash isolation.
 */
export const TERRAIN_SALTS = {
  REGION: 0x5bf03635,
  BIOME: 0x1f83d9ab,
  ELEVATION: 0x4b32a157,
  ROUGHNESS: 0x3d7b9261,
  DUST: 0x27d4eb2d,
  MACRO: 0x715476a3,
  SCATTER: 0x09e3779b,
  VARIANT: 0x1b873593,
  GROUND_DECAL_POSITION: 0x6d2a819b,
  GROUND_DECAL_VARIANT: 0x4e12c583,
  GROUND_DECAL_SCALE: 0x3f5b72e1
} as const

export interface BiomeTrait {
  baseElevation: number
  baseRoughness: number
  baseDust: number
  regionWeight: number
}

/**
 * Authoritative default traits per Martian biome.
 */
export const BIOME_TRAITS: Record<TerrainBiome, BiomeTrait> = {
  regolith: {
    baseElevation: 0.40,
    baseRoughness: 0.35,
    baseDust: 0.45,
    regionWeight: 35
  },
  dust_basin: {
    baseElevation: 0.20,
    baseRoughness: 0.15,
    baseDust: 0.85,
    regionWeight: 25
  },
  dunes: {
    baseElevation: 0.30,
    baseRoughness: 0.25,
    baseDust: 0.70,
    regionWeight: 15
  },
  basalt: {
    baseElevation: 0.65,
    baseRoughness: 0.80,
    baseDust: 0.20,
    regionWeight: 15
  },
  highlands: {
    baseElevation: 0.80,
    baseRoughness: 0.75,
    baseDust: 0.30,
    regionWeight: 12
  },
  canyon: {
    baseElevation: 0.15,
    baseRoughness: 0.70,
    baseDust: 0.40,
    regionWeight: 8
  },
  polar: {
    baseElevation: 0.50,
    baseRoughness: 0.30,
    baseDust: 0.10,
    regionWeight: 5
  }
}
