import { Assets, Rectangle, Sprite, Texture } from 'pixi.js'
import {
  MapAssetManifestSchema,
  type MapRenderProfile,
  type VisualAssetFrame
} from './mars-map-asset.types'
import type { LoadedMapAssets, RuntimeMapAsset } from './mars-map-render.types'

/**
 * Loads map asset manifest and Albedo atlas textures, producing sub-textures for all frames.
 */
export async function loadMapAssets(manifestUrl: string): Promise<LoadedMapAssets> {
  const res = await fetch(manifestUrl)
  if (!res.ok) {
    throw new Error(`Failed to load map manifest from ${manifestUrl}: ${res.statusText}`)
  }

  const rawJson = await res.json()
  const manifest = MapAssetManifestSchema.parse(rawJson)

  // In Stage 3 vertical slice, load only Albedo pages to save VRAM
  const albedoPages: Texture[] = []
  for (const page of manifest.pages) {
    const tex: Texture = await Assets.load(page.albedo)
    albedoPages.push(tex)
  }

  const assetMap = new Map<string, RuntimeMapAsset>()
  for (const [id, frameMeta] of Object.entries(manifest.assets)) {
    const pageTexture = albedoPages[frameMeta.page]
    if (!pageTexture) {
      throw new Error(`Asset "${id}" references missing page ${frameMeta.page}`)
    }

    const frameRect = new Rectangle(
      frameMeta.frame.x,
      frameMeta.frame.y,
      frameMeta.frame.w,
      frameMeta.frame.h
    )

    const subTexture = new Texture({
      source: pageTexture.source,
      frame: frameRect
    })

    assetMap.set(id, {
      texture: subTexture,
      frame: frameMeta
    })
  }

  return {
    manifest,
    albedoPages,
    assets: assetMap
  }
}

/**
 * Applies canonical anchor and scale to a terrain sprite based on render profile.
 */
export function applyMapAssetTransform(
  sprite: Sprite,
  asset: VisualAssetFrame,
  profile: MapRenderProfile
): void {
  sprite.anchor.set(asset.anchor.x, asset.anchor.y)
  const scale = 1 / profile.pixelsPerWorldUnit
  sprite.scale.set(scale)
}

/**
 * Deterministic integer sort key based on world Y coordinate.
 */
export function terrainSortKey(worldY: number, layerBias = 0): number {
  return Math.round(worldY * 100) + layerBias
}
