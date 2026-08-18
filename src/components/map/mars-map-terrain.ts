import { Container } from 'pixi.js'
import type { MapLocation } from '@/domains/map/map.types'
import { cellToWorld } from '@/domains/map/map.grid'
import type { LoadedMapAssets } from './mars-map-render.types'
import { terrainSortKey } from './mars-map-assets'
import type { TerrainVisualField } from './mars-terrain.types'
import {
  TERRAIN_BIOME_CATALOG,
  LOCATION_FEATURE_VISUALS,
  selectWeightedAsset
} from './mars-terrain-catalog'
import { hashCoord } from './mars-terrain-field'
import { TERRAIN_SALTS } from './mars-terrain-biomes'
import { createTerrainRenderable, type TerrainLightingContext } from './mars-map-lit-mesh'
import type { TerrainLightingMode } from './mars-map-lighting'
import { TERRAIN_FORMATION_RECIPES } from './mars-formation-recipes'
import { generateTerrainFlowField } from './mars-terrain-flow'
import { populateFormationClusters } from './mars-terrain-cluster'
import { populateGroundDecals } from './mars-map-ground'
import { calculateGridWorldBounds } from './mars-map-projection'

export interface TerrainLayerHierarchy {
  surfaceDetailLayer: Container
  formationGroundLayer: Container
  macroLayer: Container
  heroLayer: Container
  scatterLayer: Container
  microLayer: Container
}

/**
 * Populates MapLocation gameplay POIs with highest semantic priority.
 */
function populatePOIs(
  targetLayer: Container,
  locations: MapLocation[],
  field: TerrainVisualField,
  assets: LoadedMapAssets,
  cellWorldSize: number,
  occupiedCells: Set<string>,
  lightingContext?: TerrainLightingContext | null,
  lightingMode?: TerrainLightingMode
): void {
  for (const loc of locations) {
    const refs = LOCATION_FEATURE_VISUALS[loc.type]
    if (!refs || refs.length === 0) continue

    const variantHash = hashCoord(field.seed, loc.x, loc.y, TERRAIN_SALTS.VARIANT)
    const visualId = selectWeightedAsset(refs, variantHash)
    if (!visualId) continue

    const runtimeAsset = assets.assets.get(visualId)
    if (!runtimeAsset) continue

    const renderable = createTerrainRenderable({
      asset: runtimeAsset,
      assets,
      lightingContext,
      lightingMode
    })

    const worldPos = cellToWorld({ x: loc.x, y: loc.y }, cellWorldSize)
    renderable.position.set(worldPos.x, worldPos.y)
    renderable.zIndex = terrainSortKey(worldPos.y, 10)

    targetLayer.addChild(renderable)
    occupiedCells.add(`${loc.x},${loc.y}`)
  }
}

/**
 * Populates natural scatter rocks across non-reserved cells.
 */
function populateScatter(
  layers: TerrainLayerHierarchy,
  field: TerrainVisualField,
  assets: LoadedMapAssets,
  cellWorldSize: number,
  occupiedCells: Set<string>,
  lightingContext?: TerrainLightingContext | null,
  lightingMode?: TerrainLightingMode
): void {
  for (const cell of field.cells) {
    const key = `${cell.x},${cell.y}`
    if (occupiedCells.has(key)) continue

    const rule = TERRAIN_BIOME_CATALOG[cell.biome]
    if (!rule || rule.scatterAssets.length === 0 || rule.scatterDensity <= 0) continue

    const density = rule.scatterDensity * (0.6 + cell.roughness * 0.8)
    const scatterHash = hashCoord(field.seed, cell.x, cell.y, TERRAIN_SALTS.SCATTER)

    if ((scatterHash % 1000) < Math.floor(density * 1000)) {
      const assetId = selectWeightedAsset(rule.scatterAssets, scatterHash)
      if (!assetId) continue

      const runtimeAsset = assets.assets.get(assetId)
      if (!runtimeAsset) continue

      const renderable = createTerrainRenderable({
        asset: runtimeAsset,
        assets,
        lightingContext,
        lightingMode
      })

      const centerPos = cellToWorld({ x: cell.x, y: cell.y }, cellWorldSize)
      const jx = ((scatterHash % 17) - 8) * (cellWorldSize / 64)
      const jy = (((scatterHash >>> 8) % 17) - 8) * (cellWorldSize / 64)

      renderable.position.set(centerPos.x + jx, centerPos.y + jy)
      renderable.zIndex = terrainSortKey(centerPos.y + jy, 4)

      const isMicro = assetId.startsWith('rocks_small_')
      if (isMicro) layers.microLayer.addChild(renderable)
      else layers.scatterLayer.addChild(renderable)
    }
  }
}

/**
 * Master orchestrator for populating all terrain visual layers.
 */
export function populateTerrainLayers(
  layers: TerrainLayerHierarchy,
  locations: MapLocation[],
  field: TerrainVisualField,
  assets: LoadedMapAssets,
  cellWorldSize: number,
  occupiedCells: Set<string>,
  lightingContext?: TerrainLightingContext | null,
  lightingMode?: TerrainLightingMode
): void {
  const bounds = calculateGridWorldBounds(20, 20, cellWorldSize)
  populateGroundDecals(layers.surfaceDetailLayer, bounds, field, assets, cellWorldSize, lightingContext, lightingMode)
  populatePOIs(layers.macroLayer, locations, field, assets, cellWorldSize, occupiedCells, lightingContext, lightingMode)
  populateFormationClusters(layers, field, assets, cellWorldSize, occupiedCells, lightingContext, lightingMode)
  populateScatter(layers, field, assets, cellWorldSize, occupiedCells, lightingContext, lightingMode)
}
