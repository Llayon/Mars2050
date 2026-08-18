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
  tier?: 'hero' | 'macro'
  biomes: readonly TerrainBiome[]
  primaryAssets: readonly WeightedAssetRef[]
  primaryScaleRange?: [number, number]
  exclusionRadiusCells: number
  /**
   * Reserved for selecting authored directional asset variants (e.g. ridge_chain_01/02).
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
  mesa_cluster: {
    id: 'mesa_cluster',
    tier: 'hero',
    biomes: ['highlands', 'canyon', 'regolith'],
    primaryAssets: [{ id: 'mesa_large_01', weight: 1.2 }, { id: 'mesa_medium_01', weight: 0.8 }],
    primaryScaleRange: [2.5, 3.0],
    exclusionRadiusCells: 3.2,
    groundDecals: [{ id: 'talus_field_01', weight: 1.0 }, { id: 'rock_field_01', weight: 0.8 }],
    satellites: [
      { assetId: 'talus_field_01', distanceMin: 1.1, distanceMax: 1.8, probability: 0.95, scaleRange: [1.8, 2.4], targetLayer: 'formationGround' },
      { assetId: 'dust_drift_02', distanceMin: 1.3, distanceMax: 2.2, relativeToFlow: true, angleMinDeg: -25, angleMaxDeg: 25, probability: 0.85, scaleRange: [1.6, 2.2], targetLayer: 'surfaceDetail' },
      { assetId: 'boulder_cluster_02', distanceMin: 1.5, distanceMax: 2.5, probability: 0.85, scaleRange: [1.2, 1.8], targetLayer: 'scatter' }
    ]
  },
  escarpment_cluster: {
    id: 'escarpment_cluster',
    tier: 'hero',
    biomes: ['canyon', 'highlands', 'basalt'],
    primaryAssets: [{ id: 'escarpment_01', weight: 1.2 }, { id: 'cliff_chain_01', weight: 0.8 }],
    primaryScaleRange: [2.6, 3.2],
    exclusionRadiusCells: 3.0,
    groundDecals: [{ id: 'talus_field_01', weight: 1.2 }, { id: 'erosion_strip_01', weight: 0.8 }],
    satellites: [
      { assetId: 'talus_field_01', distanceMin: 1.0, distanceMax: 1.7, probability: 0.95, scaleRange: [1.8, 2.4], targetLayer: 'formationGround' },
      { assetId: 'rock_field_01', distanceMin: 1.2, distanceMax: 2.0, probability: 0.80, scaleRange: [1.5, 2.0], targetLayer: 'formationGround' },
      { assetId: 'boulder_cluster_01', distanceMin: 1.4, distanceMax: 2.2, probability: 0.85, scaleRange: [1.2, 1.6], targetLayer: 'scatter' }
    ]
  },
  ridge_cluster: {
    id: 'ridge_cluster',
    tier: 'hero',
    biomes: ['basalt', 'highlands', 'canyon', 'dunes'],
    primaryAssets: [{ id: 'ridge_chain_02', weight: 1.2 }, { id: 'ridge_chain_01', weight: 0.8 }],
    primaryScaleRange: [2.6, 3.2],
    exclusionRadiusCells: 2.6,
    alignToFlow: true,
    groundDecals: [{ id: 'erosion_strip_01', weight: 1.0 }, { id: 'dust_drift_02', weight: 0.8 }],
    satellites: [
      { assetId: 'dust_drift_02', distanceMin: 1.0, distanceMax: 1.8, relativeToFlow: true, angleMinDeg: -20, angleMaxDeg: 20, probability: 0.85, scaleRange: [1.6, 2.2], targetLayer: 'surfaceDetail' },
      { assetId: 'boulder_cluster_01', distanceMin: 1.1, distanceMax: 1.9, probability: 0.85, scaleRange: [1.2, 1.7], targetLayer: 'scatter' }
    ]
  },
  crater_cluster: {
    id: 'crater_cluster',
    tier: 'hero',
    biomes: ['regolith', 'highlands', 'dust_basin', 'canyon'],
    primaryAssets: [{ id: 'crater_large_02', weight: 1.2 }, { id: 'crater_large_01', weight: 0.8 }],
    primaryScaleRange: [2.2, 2.6],
    exclusionRadiusCells: 2.8,
    groundDecals: [{ id: 'cracked_ground_01', weight: 1.0 }, { id: 'rock_field_01', weight: 0.8 }],
    satellites: [
      { assetId: 'cracked_ground_01', distanceMin: 1.1, distanceMax: 1.8, probability: 0.90, scaleRange: [1.8, 2.4], targetLayer: 'formationGround' },
      { assetId: 'dust_drift_01', distanceMin: 1.2, distanceMax: 2.0, relativeToFlow: true, angleMinDeg: -30, angleMaxDeg: 30, probability: 0.85, scaleRange: [1.6, 2.2], targetLayer: 'surfaceDetail' },
      { assetId: 'rocks_small_01', distanceMin: 1.4, distanceMax: 2.4, probability: 0.90, scaleRange: [1.0, 1.5], targetLayer: 'scatter' }
    ]
  },
  cliff_cluster: {
    id: 'cliff_cluster',
    tier: 'macro',
    biomes: ['highlands', 'canyon'],
    primaryAssets: [{ id: 'cliff_chain_01', weight: 1.2 }, { id: 'ridge_01', weight: 0.8 }],
    primaryScaleRange: [2.2, 2.8],
    exclusionRadiusCells: 2.2,
    groundDecals: [{ id: 'talus_field_01', weight: 1.0 }],
    satellites: [
      { assetId: 'talus_field_01', distanceMin: 0.9, distanceMax: 1.6, probability: 0.90, scaleRange: [1.6, 2.2], targetLayer: 'formationGround' },
      { assetId: 'boulder_cluster_02', distanceMin: 1.1, distanceMax: 1.8, probability: 0.85, scaleRange: [1.1, 1.6], targetLayer: 'scatter' }
    ]
  },
  basalt_outcrop_cluster: {
    id: 'basalt_outcrop_cluster',
    tier: 'macro',
    biomes: ['basalt', 'canyon'],
    primaryAssets: [{ id: 'basalt_outcrop_large_01', weight: 1.2 }],
    primaryScaleRange: [2.2, 2.8],
    exclusionRadiusCells: 2.2,
    groundDecals: [{ id: 'rock_field_01', weight: 1.0 }],
    satellites: [
      { assetId: 'rock_field_01', distanceMin: 0.9, distanceMax: 1.6, probability: 0.90, scaleRange: [1.5, 2.0], targetLayer: 'formationGround' },
      { assetId: 'boulder_cluster_01', distanceMin: 1.1, distanceMax: 1.8, probability: 0.85, scaleRange: [1.1, 1.5], targetLayer: 'scatter' }
    ]
  }
}
