import fs from 'fs'
import path from 'path'
import sharp, { type OverlayOptions } from 'sharp'
import {
  MapAssetManifestSchema,
  type MapAssetManifest,
  type MapRenderProfile,
  type VisualAssetFrame
} from '../../src/components/map/mars-map-asset.types'
import type { ProcessedAsset } from './map-asset-process'
import { packRectangles } from './map-asset-packer'

export interface BuildAtlasOptions {
  profile: MapRenderProfile
  assets: ProcessedAsset[]
  outputDir: string
  dryRun?: boolean
}

export interface BuildAtlasResult {
  success: boolean
  manifest?: MapAssetManifest
  pagesCount: number
  errors: string[]
}

/**
 * Packs processed sprites and renders multi-channel atlas pages.
 */
export async function buildAtlasAndManifest(options: BuildAtlasOptions): Promise<BuildAtlasResult> {
  const { profile, assets, outputDir, dryRun = false } = options

  const packInputs = assets.map(a => ({
    id: a.id,
    width: a.trimmedW,
    height: a.trimmedH
  }))

  const packedPlacements = packRectangles(
    packInputs,
    profile.atlasPageSize,
    profile.padding,
    profile.extrude
  )

  const placementMap = new Map(packedPlacements.map(p => [p.id, p]))
  const pagesCount = Math.max(...packedPlacements.map(p => p.page), 0) + 1

  const compiledAssets: Record<string, VisualAssetFrame> = {}
  const pagesMetadata: MapAssetManifest['pages'] = []

  if (!dryRun && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  for (let pageIdx = 0; pageIdx < pagesCount; pageIdx++) {
    const pageId = `terrain-${pageIdx}`
    const pageAssets = assets.filter(a => placementMap.get(a.id)?.page === pageIdx)

    const albedoComposites: OverlayOptions[] = []
    const normalComposites: OverlayOptions[] = []
    const dataComposites: OverlayOptions[] = []

    for (const asset of pageAssets) {
      const placement = placementMap.get(asset.id)!
      const compositeX = placement.x - profile.extrude
      const compositeY = placement.y - profile.extrude

      albedoComposites.push({ input: asset.albedoExtruded, left: compositeX, top: compositeY })
      normalComposites.push({ input: asset.normalExtruded, left: compositeX, top: compositeY })
      dataComposites.push({ input: asset.dataExtruded, left: compositeX, top: compositeY })

      compiledAssets[asset.id] = {
        id: asset.id,
        page: pageIdx,
        frame: {
          x: placement.x,
          y: placement.y,
          w: placement.width,
          h: placement.height
        },
        anchor: asset.anchor,
        overhang: asset.overhang,
        footprint: asset.footprint,
        layer: asset.layer
      }
    }

    const albedoFileName = `terrain-albedo-${pageIdx}.webp`
    const normalFileName = `terrain-normal-${pageIdx}.png`
    const dataFileName = `terrain-data-${pageIdx}.png`

    if (!dryRun) {
      // Albedo page (Lossless WebP)
      await sharp({
        create: {
          width: profile.atlasPageSize,
          height: profile.atlasPageSize,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite(albedoComposites)
        .webp({ lossless: true })
        .toFile(path.join(outputDir, albedoFileName))

      // Normal page (RGBA lossless PNG)
      await sharp({
        create: {
          width: profile.atlasPageSize,
          height: profile.atlasPageSize,
          channels: 4,
          background: { r: 128, g: 128, b: 255, alpha: 255 }
        }
      })
        .composite(normalComposites)
        .png()
        .toFile(path.join(outputDir, normalFileName))

      // Data page (RGBA lossless PNG)
      await sharp({
        create: {
          width: profile.atlasPageSize,
          height: profile.atlasPageSize,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 255 }
        }
      })
        .composite(dataComposites)
        .png()
        .toFile(path.join(outputDir, dataFileName))
    }

    pagesMetadata.push({
      id: pageId,
      albedo: `/assets/map/${albedoFileName}`,
      normal: `/assets/map/${normalFileName}`,
      data: `/assets/map/${dataFileName}`,
      width: profile.atlasPageSize,
      height: profile.atlasPageSize
    })
  }

  const finalManifest: MapAssetManifest = {
    version: 2,
    profile,
    pages: pagesMetadata,
    assets: compiledAssets
  }

  const manifestValidation = MapAssetManifestSchema.safeParse(finalManifest)
  if (!manifestValidation.success) {
    return {
      success: false,
      pagesCount,
      errors: manifestValidation.error.issues.map(i => `Compiled manifest failed validation [${i.path.join('.')}]: ${i.message}`)
    }
  }

  if (!dryRun) {
    fs.writeFileSync(
      path.join(outputDir, 'terrain-manifest.json'),
      JSON.stringify(finalManifest, null, 2),
      'utf-8'
    )
  }

  return {
    success: true,
    manifest: finalManifest,
    pagesCount,
    errors: []
  }
}
