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
export async function loadMapAssets(
  manifestUrl: string = '/assets/map/terrain-manifest.json'
): Promise<LoadedMapAssets> {
  const res = await fetch(manifestUrl)
  if (!res.ok) {
    throw new Error(`Failed to load map manifest from ${manifestUrl}: ${res.statusText}`)
  }

  const rawJson = await res.json()
  const manifest = MapAssetManifestSchema.parse(rawJson)

  const albedoPages: Texture[] = []
  const normalPages: Texture[] = []
  const dataPages: Texture[] = []
  let lightingAvailable = true

  for (const page of manifest.pages) {
    const albedoTex: Texture = await Assets.load(page.albedo)
    albedoPages.push(albedoTex)

    if (lightingAvailable) {
      try {
        if (page.normal && page.data) {
          const [normTex, dataTex] = await Promise.all([
            Assets.load<Texture>(page.normal),
            Assets.load<Texture>(page.data)
          ])
          normalPages.push(normTex)
          dataPages.push(dataTex)
        } else {
          lightingAvailable = false
        }
      } catch (err) {
        console.warn('Failed to load companion normal/data textures, falling back to baked Albedo:', err)
        lightingAvailable = false
      }
    }
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

    let normalSubTexture: Texture | undefined
    let dataSubTexture: Texture | undefined

    if (lightingAvailable) {
      const normalPage = normalPages[frameMeta.page]
      const dataPage = dataPages[frameMeta.page]
      if (normalPage && dataPage) {
        normalSubTexture = new Texture({
          source: normalPage.source,
          frame: frameRect
        })
        dataSubTexture = new Texture({
          source: dataPage.source,
          frame: frameRect
        })
      }
    }

    assetMap.set(id, {
      texture: subTexture,
      normalTexture: normalSubTexture,
      dataTexture: dataSubTexture,
      frame: frameMeta
    })
  }

  return {
    manifest,
    albedoPages,
    normalPages,
    dataPages,
    lightingAvailable,
    assets: assetMap
  }
}

export interface TransformableDisplayObject {
  scale: { set: (s: number) => void }
  anchor?: { set: (x: number, y: number) => void }
}

/**
 * Applies canonical anchor and scale to a terrain sprite or mesh based on render profile.
 */
export function applyMapAssetTransform(
  target: TransformableDisplayObject,
  asset: VisualAssetFrame,
  profile: MapRenderProfile
): void {
  if (target.anchor) {
    target.anchor.set(asset.anchor.x, asset.anchor.y)
  }
  const scale = 1 / profile.pixelsPerWorldUnit
  target.scale.set(scale)
}

/**
 * Deterministic integer sort key based on world Y coordinate.
 */
export function terrainSortKey(worldY: number, layerBias = 0): number {
  return Math.round(worldY * 100) + layerBias
}
