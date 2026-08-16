import type { Container, Texture } from 'pixi.js'
import type { MapAssetManifest, VisualAssetFrame } from './mars-map-asset.types'
import type { MapLocation } from '@/domains/map/map.types'

export interface RuntimeMapAsset {
  /** Stage-4 / baked fallback Albedo subtexture */
  texture: Texture
  normalTexture?: Texture
  dataTexture?: Texture
  frame: VisualAssetFrame
}

export interface LoadedMapAssets {
  manifest: MapAssetManifest
  albedoPages: Texture[]
  normalPages: Texture[]
  dataPages: Texture[]
  lightingAvailable: boolean
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
