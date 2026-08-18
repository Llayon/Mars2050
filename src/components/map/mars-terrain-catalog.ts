import type { MapLocationType } from '@/domains/map/map.types'
import type { TerrainBiome } from './mars-terrain.types'

/**
 * Weighted reference to a terrain asset ID.
 */
export interface WeightedAssetRef {
  id: string
  weight: number
}

/**
 * Visual styling and asset composition rules for a Martian biome.
 */
export interface TerrainBiomeVisualRule {
  /** Hex RGB color representing the biome ground tint */
  baseColor: number
  /** Ground decal sprite variants */
  groundDecals: readonly WeightedAssetRef[]
  /** Macro formation sprite variants (ridges, craters, plateaus) */
  macroAssets: readonly WeightedAssetRef[]
  /** Scatter sprite variants (rocks, boulders) */
  scatterAssets: readonly WeightedAssetRef[]
  /** Probability threshold (0..1) for placing scatter in a cell */
  scatterDensity: number
  /** Probability threshold (0..1) for placing macro decor in a cell */
  macroDensity: number
}

/**
 * Authoritative visual rules per Martian biome using 13 MVP production asset IDs.
 */
export const TERRAIN_BIOME_CATALOG: Record<TerrainBiome, TerrainBiomeVisualRule> = {
  regolith: {
    baseColor: 0xb4532a,
    groundDecals: [
      { id: 'regolith_patch_01', weight: 1.0 },
      { id: 'regolith_patch_02', weight: 1.0 },
      { id: 'dust_drift_01', weight: 0.8 },
      { id: 'dust_drift_02', weight: 0.8 },
      { id: 'cracked_ground_01', weight: 0.7 }
    ],
    macroAssets: [
      { id: 'crater_small_01', weight: 1.0 },
      { id: 'crater_large_01', weight: 0.8 },
      { id: 'crater_large_02', weight: 0.6 }
    ],
    scatterAssets: [
      { id: 'rocks_small_01', weight: 1.0 },
      { id: 'boulder_cluster_01', weight: 0.5 }
    ],
    scatterDensity: 0.10,
    macroDensity: 0.04
  },
  dust_basin: {
    baseColor: 0xc87137,
    groundDecals: [
      { id: 'dust_patch_01', weight: 1.0 },
      { id: 'dust_drift_01', weight: 1.2 },
      { id: 'dust_drift_02', weight: 1.2 }
    ],
    macroAssets: [
      { id: 'crater_large_01', weight: 0.5 },
      { id: 'crater_large_02', weight: 0.5 }
    ],
    scatterAssets: [{ id: 'rocks_small_02', weight: 1.0 }],
    scatterDensity: 0.04,
    macroDensity: 0.02
  },
  dunes: {
    baseColor: 0xc47b3b,
    groundDecals: [
      { id: 'dust_patch_01', weight: 0.8 },
      { id: 'dust_drift_01', weight: 1.0 },
      { id: 'dust_drift_02', weight: 1.0 }
    ],
    macroAssets: [
      { id: 'dune_ridge_01', weight: 1.0 },
      { id: 'ridge_chain_01', weight: 0.6 },
      { id: 'ridge_chain_02', weight: 0.6 }
    ],
    scatterAssets: [{ id: 'rocks_small_01', weight: 0.4 }],
    scatterDensity: 0.03,
    macroDensity: 0.06
  },
  basalt: {
    baseColor: 0x3d271d,
    groundDecals: [
      { id: 'basalt_patch_01', weight: 1.0 },
      { id: 'rock_field_01', weight: 1.2 },
      { id: 'talus_field_01', weight: 1.0 }
    ],
    macroAssets: [
      { id: 'basalt_outcrop_large_01', weight: 1.2 },
      { id: 'ridge_chain_01', weight: 0.8 },
      { id: 'ridge_chain_02', weight: 0.8 },
      { id: 'ridge_01', weight: 0.6 }
    ],
    scatterAssets: [
      { id: 'boulder_cluster_01', weight: 1.0 },
      { id: 'boulder_cluster_02', weight: 1.0 }
    ],
    scatterDensity: 0.16,
    macroDensity: 0.08
  },
  highlands: {
    baseColor: 0x7c2d1b,
    groundDecals: [
      { id: 'regolith_patch_02', weight: 1.0 },
      { id: 'erosion_strip_01', weight: 0.9 },
      { id: 'rock_field_01', weight: 0.8 },
      { id: 'talus_field_01', weight: 1.0 }
    ],
    macroAssets: [
      { id: 'mesa_large_01', weight: 1.2 },
      { id: 'mesa_medium_01', weight: 0.8 },
      { id: 'escarpment_01', weight: 1.0 },
      { id: 'cliff_chain_01', weight: 1.0 },
      { id: 'ridge_chain_02', weight: 0.8 }
    ],
    scatterAssets: [
      { id: 'rocks_small_01', weight: 1.0 },
      { id: 'boulder_cluster_02', weight: 0.8 }
    ],
    scatterDensity: 0.14,
    macroDensity: 0.10
  },
  canyon: {
    baseColor: 0x5a2314,
    groundDecals: [
      { id: 'basalt_patch_01', weight: 0.8 },
      { id: 'erosion_strip_01', weight: 1.2 },
      { id: 'rock_field_01', weight: 1.0 },
      { id: 'talus_field_01', weight: 1.2 }
    ],
    macroAssets: [
      { id: 'escarpment_01', weight: 1.2 },
      { id: 'cliff_chain_01', weight: 1.2 },
      { id: 'mesa_large_01', weight: 0.8 },
      { id: 'ridge_chain_02', weight: 0.8 }
    ],
    scatterAssets: [
      { id: 'boulder_cluster_01', weight: 1.0 },
      { id: 'rocks_small_02', weight: 1.0 }
    ],
    scatterDensity: 0.12,
    macroDensity: 0.10
  },
  polar: {
    baseColor: 0xd6b7a5,
    groundDecals: [
      { id: 'dust_patch_01', weight: 1.0 },
      { id: 'dust_drift_01', weight: 0.8 },
      { id: 'dust_drift_02', weight: 0.8 }
    ],
    macroAssets: [{ id: 'dune_ridge_01', weight: 0.5 }],
    scatterAssets: [{ id: 'rocks_small_01', weight: 0.5 }],
    scatterDensity: 0.05,
    macroDensity: 0.03
  }
}

/**
 * Declarative mapping of MapLocation POI gameplay types to production visual features.
 */
export const LOCATION_FEATURE_VISUALS: Record<MapLocationType, readonly WeightedAssetRef[]> = {
  plains: [],
  mountains: [
    { id: 'ridge_01', weight: 1.0 },
    { id: 'ridge_02', weight: 1.0 }
  ],
  canyon: [
    { id: 'ridge_01', weight: 1.0 },
    { id: 'ridge_02', weight: 1.0 }
  ],
  crater: [
    { id: 'crater_small_01', weight: 1.0 },
    { id: 'crater_medium_02', weight: 1.0 }
  ],
  ice_cap: []
}

/**
 * Pure, deterministic weighted selection from a list of asset references.
 * Returns null if the list is empty or total weight is zero.
 */
export function selectWeightedAsset(
  refs: readonly WeightedAssetRef[],
  hash: number
): string | null {
  if (!refs || refs.length === 0) return null

  let totalWeight = 0
  for (const ref of refs) {
    if (Number.isFinite(ref.weight) && ref.weight > 0) {
      totalWeight += ref.weight
    }
  }

  if (totalWeight <= 0) return null

  // Normalize hash to [0..totalWeight)
  const positiveHash = (hash >>> 0)
  let sample = (positiveHash % 10000) / 10000 * totalWeight

  for (const ref of refs) {
    if (!Number.isFinite(ref.weight) || ref.weight <= 0) continue
    sample -= ref.weight
    if (sample <= 0) {
      return ref.id
    }
  }

  return refs[0].id
}
