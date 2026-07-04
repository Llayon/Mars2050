import * as PIXI from 'pixi.js'
import { ASSET_MANIFEST } from '@/components/colony/sprites/asset-manifest'
import type { BuildingRow } from '@/domains/building/building.types'
import { COLONY_CENTER_COORD, TERRAIN_ASSETS } from '@/domains/colony/colony-terrain.config'
import type { TerrainGrid, TerrainType } from '@/domains/colony/colony-terrain.types'
import type { ColonyAssetKey, ColonyAssetLoadResult, ColonyAssetRequest, ColonyTextureMap } from './colony-canvas-asset-types'

const DIRT_MASK_KEY = 'dirt_mask'
const DIRT_MASK_SRC = '/assets/terrain/dirt_mask.jpg'

async function loadTexture(textures: ColonyTextureMap, request: ColonyAssetRequest): Promise<ColonyAssetLoadResult> {
  const { key, src } = request
  if (!src || textures[key]) return { key, src, loaded: false }

  try {
    textures[key] = await PIXI.Assets.load(src)
    return { key, src, loaded: true }
  } catch {
    return { key, src, loaded: false }
  }
}

function getVisibleTerrainTypes(terrainGrid: TerrainGrid | undefined, radius: number): TerrainType[] {
  if (!terrainGrid || terrainGrid.length === 0) return ['regolith']

  const types = new Set<TerrainType>(['regolith'])
  for (const cell of terrainGrid) {
    const maxDist = Math.max(Math.abs(cell.x - COLONY_CENTER_COORD), Math.abs(cell.y - COLONY_CENTER_COORD))
    if (maxDist <= radius + 1.5) {
      types.add(cell.t)
    }
  }
  return [...types]
}

export async function loadVisibleColonyTextures(
  textures: ColonyTextureMap,
  terrainGrid: TerrainGrid | undefined,
  radius: number,
  buildings: BuildingRow[]
): Promise<boolean> {
  const requests = new Map<ColonyAssetKey, ColonyAssetRequest>()

  for (const terrainType of getVisibleTerrainTypes(terrainGrid, radius)) {
    const key = `terrain_${terrainType}` as ColonyAssetKey
    requests.set(key, { key, src: TERRAIN_ASSETS[terrainType], group: 'terrain', priority: 'visible' })
  }

  for (const building of buildings) {
    requests.set(building.type, { key: building.type, src: ASSET_MANIFEST[building.type], group: 'building', priority: 'visible' })
  }

  const results = await Promise.all([...requests.values()].map(request => loadTexture(textures, request)))
  return results.some(result => result.loaded)
}

export async function preloadRemainingColonyTextures(textures: ColonyTextureMap): Promise<boolean> {
  const requests = new Map<ColonyAssetKey, ColonyAssetRequest>()

  for (const [terrainType, src] of Object.entries(TERRAIN_ASSETS)) {
    const key = `terrain_${terrainType as TerrainType}` as ColonyAssetKey
    requests.set(key, { key, src, group: 'terrain', priority: 'remaining' })
  }

  for (const [buildingType, src] of Object.entries(ASSET_MANIFEST)) {
    const key = buildingType as ColonyAssetKey
    requests.set(key, { key, src, group: 'building', priority: 'remaining' })
  }

  requests.set(DIRT_MASK_KEY, { key: DIRT_MASK_KEY, src: DIRT_MASK_SRC, group: 'mask', priority: 'remaining' })

  const results = await Promise.all([...requests.values()].map(request => loadTexture(textures, request)))
  return results.some(result => result.loaded)
}

export function scheduleColonyTexturePreload(callback: () => void): () => void {
  const idleWindow = window as Window & {
    requestIdleCallback?: (cb: () => void, options?: { timeout?: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }

  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 2500 })
    return () => idleWindow.cancelIdleCallback?.(handle)
  }

  const handle = window.setTimeout(callback, 800)
  return () => window.clearTimeout(handle)
}
