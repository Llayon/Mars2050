import * as PIXI from 'pixi.js'
import { ASSET_MANIFEST } from '@/components/colony/sprites/asset-manifest'
import type { BuildingRow } from '@/domains/building/building.types'
import { COLONY_CENTER_COORD, TERRAIN_ASSETS } from '@/domains/colony/colony-terrain.config'
import type { TerrainGrid, TerrainType } from '@/domains/colony/colony-terrain.types'

export type ColonyTextureMap = Record<string, PIXI.Texture>

const DIRT_MASK_KEY = 'dirt_mask'
const DIRT_MASK_SRC = '/assets/terrain/dirt_mask.jpg'

async function loadTexture(textures: ColonyTextureMap, key: string, src: string | undefined): Promise<boolean> {
  if (!src || textures[key]) return false

  try {
    textures[key] = await PIXI.Assets.load(src)
    return true
  } catch {
    return false
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

export function loadBaseColonyTextures(textures: ColonyTextureMap): Promise<boolean> {
  return loadTexture(textures, 'terrain_regolith', TERRAIN_ASSETS.regolith)
}

export async function loadVisibleColonyTextures(
  textures: ColonyTextureMap,
  terrainGrid: TerrainGrid | undefined,
  radius: number,
  buildings: BuildingRow[]
): Promise<boolean> {
  const requests = new Map<string, string | undefined>()

  for (const terrainType of getVisibleTerrainTypes(terrainGrid, radius)) {
    requests.set(`terrain_${terrainType}`, TERRAIN_ASSETS[terrainType])
  }

  for (const building of buildings) {
    requests.set(building.type, ASSET_MANIFEST[building.type])
  }

  const results = await Promise.all([...requests].map(([key, src]) => loadTexture(textures, key, src)))
  return results.some(Boolean)
}

export async function preloadRemainingColonyTextures(textures: ColonyTextureMap): Promise<boolean> {
  const requests = new Map<string, string | undefined>()

  for (const [terrainType, src] of Object.entries(TERRAIN_ASSETS)) {
    requests.set(`terrain_${terrainType}`, src)
  }

  for (const [buildingType, src] of Object.entries(ASSET_MANIFEST)) {
    requests.set(buildingType, src)
  }

  requests.set(DIRT_MASK_KEY, DIRT_MASK_SRC)

  const results = await Promise.all([...requests].map(([key, src]) => loadTexture(textures, key, src)))
  return results.some(Boolean)
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
