import type * as PIXI from 'pixi.js'
import type { BuildingTypeKey } from '@/domains/building/building.types'
import type { TerrainType } from '@/domains/colony/colony-terrain.types'

export type ColonyAssetKey = `terrain_${TerrainType}` | BuildingTypeKey | 'dirt_mask'
export type ColonyAssetGroup = 'terrain' | 'building' | 'mask'
export type ColonyAssetPriority = 'visible' | 'remaining'
export type ColonyTextureMap = Partial<Record<ColonyAssetKey, PIXI.Texture>>

export interface ColonyAssetRequest {
  key: ColonyAssetKey
  src?: string
  group: ColonyAssetGroup
  priority: ColonyAssetPriority
}

export interface ColonyAssetLoadResult {
  key: ColonyAssetKey
  loaded: boolean
  src?: string
}
