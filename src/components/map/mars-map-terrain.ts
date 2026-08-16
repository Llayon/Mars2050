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

/**
 * Places macro formations (MapLocation POIs and biome macro features)
 * respecting strict occupancy priority: MapLocation Feature > Biome Macro.
 */
export function populateMacroTerrain(
  parentLayer: Container,
  locations: MapLocation[],
  field: TerrainVisualField,
  assets: LoadedMapAssets,
  cellWorldSize: number,
  occupiedCells: Set<string>,
  lightingContext?: TerrainLightingContext | null,
  lightingMode?: TerrainLightingMode
): void {
  // 1. Primary Priority: MapLocation POI Features
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

    parentLayer.addChild(renderable)
    occupiedCells.add(`${loc.x},${loc.y}`)
  }

  // 2. Secondary Priority: Biome Macro Formations with spacing constraints
  for (const cell of field.cells) {
    const key = `${cell.x},${cell.y}`
    if (occupiedCells.has(key)) continue

    const rule = TERRAIN_BIOME_CATALOG[cell.biome]
    if (!rule || rule.macroAssets.length === 0 || rule.macroDensity <= 0) continue

    // Check spacing: no macro on adjacent 4-way neighbors
    const hasAdjacentMacro =
      occupiedCells.has(`${cell.x + 1},${cell.y}`) ||
      occupiedCells.has(`${cell.x - 1},${cell.y}`) ||
      occupiedCells.has(`${cell.x},${cell.y + 1}`) ||
      occupiedCells.has(`${cell.x},${cell.y - 1}`)

    if (hasAdjacentMacro) continue

    const macroHash = hashCoord(field.seed, cell.x, cell.y, TERRAIN_SALTS.MACRO)
    const threshold = Math.floor(rule.macroDensity * 1000)

    if ((macroHash % 1000) < threshold) {
      const variantHash = hashCoord(field.seed, cell.x, cell.y, TERRAIN_SALTS.VARIANT)
      const assetId = selectWeightedAsset(rule.macroAssets, variantHash)
      if (!assetId) continue

      const runtimeAsset = assets.assets.get(assetId)
      if (!runtimeAsset) continue

      const renderable = createTerrainRenderable({
        asset: runtimeAsset,
        assets,
        lightingContext,
        lightingMode
      })

      const worldPos = cellToWorld({ x: cell.x, y: cell.y }, cellWorldSize)
      renderable.position.set(worldPos.x, worldPos.y)
      renderable.zIndex = terrainSortKey(worldPos.y, 8)

      parentLayer.addChild(renderable)
      occupiedCells.add(key)
    }
  }
}

/**
 * Places deterministic scatter across cells governed by biome rules and density.
 */
export function populateScatterTerrain(
  parentLayer: Container,
  field: TerrainVisualField,
  assets: LoadedMapAssets,
  cellWorldSize: number,
  occupiedCells: Set<string>,
  lightingContext?: TerrainLightingContext | null,
  lightingMode?: TerrainLightingMode
): void {
  for (const cell of field.cells) {
    const key = `${cell.x},${cell.y}`
    // Do not crowd POIs or large macro formations with heavy scatter
    if (occupiedCells.has(key)) continue

    const rule = TERRAIN_BIOME_CATALOG[cell.biome]
    if (!rule || rule.scatterAssets.length === 0 || rule.scatterDensity <= 0) continue

    // Modulate scatter density by roughness and dust
    const effectiveDensity = rule.scatterDensity * (0.6 + cell.roughness * 0.8) * (1.2 - cell.dust * 0.4)
    const threshold = Math.floor(effectiveDensity * 1000)

    const scatterHash = hashCoord(field.seed, cell.x, cell.y, TERRAIN_SALTS.SCATTER)
    if ((scatterHash % 1000) < threshold) {
      const variantHash = hashCoord(field.seed, cell.x, cell.y, TERRAIN_SALTS.VARIANT)
      const assetId = selectWeightedAsset(rule.scatterAssets, variantHash)
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
      // Slight deterministic sub-cell jitter
      const offsetX = ((scatterHash % 17) - 8) * (cellWorldSize / 64)
      const offsetY = (((scatterHash >>> 8) % 17) - 8) * (cellWorldSize / 64)

      renderable.position.set(centerPos.x + offsetX, centerPos.y + offsetY)
      renderable.zIndex = terrainSortKey(centerPos.y + offsetY, 4)

      parentLayer.addChild(renderable)
    }
  }
}
