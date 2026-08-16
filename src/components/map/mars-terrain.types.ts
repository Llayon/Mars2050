/**
 * Terrain Biomes and Visual Field types for Mars2050 2.5D presentation.
 * Note: These are presentation-only types, separate from DB MapLocation / gameplay.
 */

export const TERRAIN_BIOMES = [
  'regolith',
  'dust_basin',
  'dunes',
  'basalt',
  'highlands',
  'canyon',
  'polar'
] as const

export type TerrainBiome = typeof TERRAIN_BIOMES[number]

/**
 * Macro-region descriptor representing a continuous visual biome expanse.
 */
export interface TerrainVisualRegion {
  id: number
  biome: TerrainBiome
  centerX: number
  centerY: number
  scaleX: number
  scaleY: number
  influence: number
  seed: number
}

/**
 * Individual visual grid cell metadata.
 */
export interface TerrainVisualCell {
  x: number
  y: number
  biome: TerrainBiome
  regionId: number
  /** Normalized visual elevation (0..1) */
  elevation: number
  /** Normalized visual surface roughness (0..1) */
  roughness: number
  /** Normalized visual dust coverage (0..1) */
  dust: number
}

/**
 * Deterministic visual terrain field comprising macro regions and discrete cells.
 */
export interface TerrainVisualField {
  width: number
  height: number
  seed: number
  regions: readonly TerrainVisualRegion[]
  cells: readonly TerrainVisualCell[]
}

/**
 * Options for terrain visual field generator.
 */
export interface TerrainFieldOptions {
  width: number
  height: number
  seed?: number
  allowPolar?: boolean
}
