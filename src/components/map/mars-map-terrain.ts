import { Container, Sprite } from 'pixi.js'
import type { MapLocation, MapLocationType } from '@/domains/map/map.types'
import { cellToWorld } from '@/domains/map/map.grid'
import type { LoadedMapAssets } from './mars-map-render.types'
import { applyMapAssetTransform, terrainSortKey } from './mars-map-assets'
import { enumerateGridCells } from './mars-map-projection'

/**
 * Visual asset mapping for location types.
 */
const LOCATION_VISUALS: Record<MapLocationType, string | null> = {
  plains: null,
  mountains: 'cliff_ridge_01',
  canyon: 'cliff_ridge_01',
  crater: 'crater_medium_01',
  ice_cap: null
}

/**
 * Simple 32-bit deterministic integer hash for decor placement.
 */
export function hashCell(seed: number, x: number, y: number): number {
  let h = (seed ^ (x * 374761393) ^ (y * 668265263)) >>> 0
  h = (h ^ (h >>> 13)) * 1274126177
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * Places macro formations (craters, cliffs) for MapLocations.
 */
export function populateMacroTerrain(
  parentLayer: Container,
  locations: MapLocation[],
  assets: LoadedMapAssets,
  cellWorldSize: number
): void {
  for (const loc of locations) {
    const visualId = LOCATION_VISUALS[loc.type]
    if (!visualId) continue

    const runtimeAsset = assets.assets.get(visualId)
    if (!runtimeAsset) continue

    const sprite = new Sprite(runtimeAsset.texture)
    applyMapAssetTransform(sprite, runtimeAsset.frame, assets.manifest.profile)

    const worldPos = cellToWorld({ x: loc.x, y: loc.y }, cellWorldSize)
    sprite.position.set(worldPos.x, worldPos.y)
    sprite.zIndex = terrainSortKey(worldPos.y, 10)

    parentLayer.addChild(sprite)
  }
}

/**
 * Places deterministic rock scatter across empty or general terrain cells.
 */
export function populateScatterTerrain(
  parentLayer: Container,
  width: number,
  height: number,
  assets: LoadedMapAssets,
  cellWorldSize: number,
  seed: number = 42
): void {
  const rockAsset = assets.assets.get('rock_scatter_01')
  if (!rockAsset) return

  const allCells = enumerateGridCells(width, height)
  for (const cell of allCells) {
    const hash = hashCell(seed, cell.x, cell.y)
    // Place a rock on roughly 18% of cells
    if (hash % 100 < 18) {
      const sprite = new Sprite(rockAsset.texture)
      applyMapAssetTransform(sprite, rockAsset.frame, assets.manifest.profile)

      const centerPos = cellToWorld(cell, cellWorldSize)
      // Slight sub-cell jitter for organic distribution
      const offsetX = ((hash % 17) - 8) * (cellWorldSize / 64)
      const offsetY = (((hash >>> 8) % 17) - 8) * (cellWorldSize / 64)

      sprite.position.set(centerPos.x + offsetX, centerPos.y + offsetY)
      sprite.zIndex = terrainSortKey(centerPos.y + offsetY, 5)

      parentLayer.addChild(sprite)
    }
  }
}
