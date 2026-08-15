import type { Container, Texture } from 'pixi.js'
import type { MapAssetManifest, VisualAssetFrame } from './mars-map-asset.types'
import type { MapLocation } from '@/domains/map/map.types'

export interface RuntimeMapAsset {
  texture: Texture
  frame: VisualAssetFrame
}

export interface LoadedMapAssets {
  manifest: MapAssetManifest
  albedoPages: Texture[]
  assets: ReadonlyMap<string, RuntimeMapAsset>
}

export interface MapRenderScene {
  worldRoot: Container
  groundLayer: Container
  macroLayer: Container
  scatterLayer: Container
  interactionLayer: Container
}

export interface MapInteractionCallbacks {
  onSelectLocation: (location: MapLocation | null) => void
  onHoverLocation?: (location: MapLocation | null) => void
}
