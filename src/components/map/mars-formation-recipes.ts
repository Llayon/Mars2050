import type { TerrainBiome } from './mars-terrain.types'
import type { WeightedAssetRef } from './mars-terrain-catalog'

/**
 * Placement rule for a satellite decor element within a geological cluster.
 */
export interface FormationSatelliteRule {
  assetId: string
  /** Distance from cluster center in cell units */
  distanceMin: number
  distanceMax: number
  /** Offset angle in radians relative to flow direction or random */
  relativeToFlow?: boolean
  angleMinDeg?: number
  angleMaxDeg?: number
  /** Probability of spawning (0..1) */
  probability: number
  scaleRange?: [number, number]
  alpha?: number
  targetLayer: 'surfaceDetail' | 'formationGround' | 'macro' | 'scatter'
}

/**
 * Authoritative geological formation cluster recipe.
 */
export interface TerrainFormationRecipe {
  id: string
  biomes: readonly TerrainBiome[]
  primaryAssets: readonly WeightedAssetRef[]
  exclusionRadiusCells: number
  /**
   * Reserved for selecting authored directional asset variants (e.g. ridge_chain_01_a/b/c).
   * Runtime rotation of primary formations is strictly prohibited to preserve universal sun azimuth.
   */
  alignToFlow?: boolean
  groundDecals?: readonly WeightedAssetRef[]
  satellites?: readonly FormationSatelliteRule[]
}

/**
 * Registry of canonical Martian geological cluster recipes.
 */
export const TERRAIN_FORMATION_RECIPES: Record<string, TerrainFormationRecipe> = {
  crater_cluster: {
    id: 'crater_cluster',
    biomes: ['regolith', 'highlands', 'dust_basin', 'canyon'],
    primaryAssets: [
      { id: 'crater_large_01', weight: 1.0 },
      { id: 'crater_medium_02', weight: 0.8 }
    ],
    exclusionRadiusCells: 2.5,
    groundDecals: [{ id: 'cracked_ground_01', weight: 1.0 }],
    satellites: [
      {
        assetId: 'dust_drift_01',
        distanceMin: 0.8,
        distanceMax: 1.6,
        relativeToFlow: true,
        angleMinDeg: -30,
        angleMaxDeg: 30,
        probability: 0.85,
        targetLayer: 'surfaceDetail'
      },
      {
        assetId: 'rock_field_01',
        distanceMin: 0.9,
        distanceMax: 1.5,
        probability: 0.75,
        targetLayer: 'formationGround'
      },
      {
        assetId: 'rocks_small_01',
        distanceMin: 1.2,
        distanceMax: 2.0,
        probability: 0.90,
        targetLayer: 'scatter'
      }
    ]
  },
  mesa_cluster: {
    id: 'mesa_cluster',
    biomes: ['highlands', 'canyon', 'regolith'],
    primaryAssets: [
      { id: 'mesa_medium_01', weight: 1.0 }
    ],
    exclusionRadiusCells: 3.0,
    groundDecals: [{ id: 'erosion_strip_01', weight: 1.0 }],
    satellites: [
      {
        assetId: 'rock_field_01',
        distanceMin: 1.0,
        distanceMax: 1.8,
        probability: 0.90,
        targetLayer: 'formationGround'
      },
      {
        assetId: 'dust_drift_01',
        distanceMin: 1.2,
        distanceMax: 2.2,
        relativeToFlow: true,
        angleMinDeg: -20,
        angleMaxDeg: 20,
        probability: 0.80,
        targetLayer: 'surfaceDetail'
      },
      {
        assetId: 'boulder_cluster_02',
        distanceMin: 1.4,
        distanceMax: 2.4,
        probability: 0.85,
        targetLayer: 'scatter'
      }
    ]
  },
  ridge_cluster: {
    id: 'ridge_cluster',
    biomes: ['basalt', 'highlands', 'canyon', 'dunes'],
    primaryAssets: [
      { id: 'ridge_chain_01', weight: 1.0 },
      { id: 'ridge_01', weight: 0.6 }
    ],
    exclusionRadiusCells: 2.0,
    alignToFlow: true,
    groundDecals: [{ id: 'erosion_strip_01', weight: 1.0 }],
    satellites: [
      {
        assetId: 'dust_drift_01',
        distanceMin: 0.8,
        distanceMax: 1.4,
        relativeToFlow: true,
        angleMinDeg: -15,
        angleMaxDeg: 15,
        probability: 0.80,
        targetLayer: 'surfaceDetail'
      },
      {
        assetId: 'boulder_cluster_01',
        distanceMin: 1.0,
        distanceMax: 1.8,
        probability: 0.85,
        targetLayer: 'scatter'
      }
    ]
  }
}
