import fs from 'fs'
import path from 'path'
import sharp, { type OverlayOptions } from 'sharp'
import { RawAssetManifestSchema, type RawAssetManifest } from '../src/components/map/mars-map-raw.types'
import { MapAssetManifestSchema, type MapAssetManifest, type VisualAssetFrame } from '../src/components/map/mars-map-asset.types'
import { computeAlphaTrim, extrudeImage, packRectangles } from './helpers/map-asset-packer'

export interface CompileMapAssetsOptions {
  inputManifestPath: string
  baseDir?: string
  outputDir: string
  validateOnly?: boolean
  dryRun?: boolean
  report?: boolean
}

export interface CompileMapAssetsResult {
  success: boolean
  manifest?: MapAssetManifest
  pagesCount?: number
  assetsCount?: number
  errors?: string[]
}

/**
 * Creates a solid color RGBA image buffer.
 */
async function createSolidColorBuffer(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  alpha: number = 255
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r, g, b, alpha }
    }
  }).png().toBuffer()
}

/**
 * Compiles raw asset images and manifest into deterministically packed multi-channel texture atlases.
 */
export async function compileMapAssets(options: CompileMapAssetsOptions): Promise<CompileMapAssetsResult> {
  const {
    inputManifestPath,
    baseDir = path.dirname(inputManifestPath),
    outputDir,
    validateOnly = false,
    dryRun = false,
    report = false
  } = options

  const errors: string[] = []

  if (!fs.existsSync(inputManifestPath)) {
    return { success: false, errors: [`Input manifest not found: ${inputManifestPath}`] }
  }

  const rawJson = JSON.parse(fs.readFileSync(inputManifestPath, 'utf-8'))
  const parsedRaw = RawAssetManifestSchema.safeParse(rawJson)

  if (!parsedRaw.success) {
    return {
      success: false,
      errors: parsedRaw.error.issues.map(i => `Manifest validation error [${i.path.join('.')}]: ${i.message}`)
    }
  }

  const rawManifest: RawAssetManifest = parsedRaw.data
  const profile = rawManifest.profile

  // Step 1: Validate existence and dimensions of companion textures
  interface ValidatedAsset {
    raw: RawAssetManifest['assets'][number]
    albedoBuf: Buffer
    normalBuf: Buffer | null
    dataBuf: Buffer | null
    width: number
    height: number
  }

  const validatedAssets: ValidatedAsset[] = []

  for (const asset of rawManifest.assets) {
    const albedoPath = path.resolve(baseDir, asset.source.albedo)
    if (!fs.existsSync(albedoPath)) {
      errors.push(`Asset "${asset.id}": Albedo file not found at ${albedoPath}`)
      continue
    }

    const albedoBuf = fs.readFileSync(albedoPath)
    const albedoMeta = await sharp(albedoBuf).metadata()
    const width = albedoMeta.width || 0
    const height = albedoMeta.height || 0

    if (width === 0 || height === 0) {
      errors.push(`Asset "${asset.id}": Invalid albedo dimensions ${width}x${height}`)
      continue
    }

    let normalBuf: Buffer | null = null
    if (asset.source.normal) {
      const normalPath = path.resolve(baseDir, asset.source.normal)
      if (!fs.existsSync(normalPath)) {
        errors.push(`Asset "${asset.id}": Normal file not found at ${normalPath}`)
      } else {
        normalBuf = fs.readFileSync(normalPath)
        const normalMeta = await sharp(normalBuf).metadata()
        if (normalMeta.width !== width || normalMeta.height !== height) {
          errors.push(`Asset "${asset.id}": Normal dimensions (${normalMeta.width}x${normalMeta.height}) mismatch Albedo (${width}x${height})`)
        }
      }
    }

    let dataBuf: Buffer | null = null
    if (asset.source.data) {
      const dataPath = path.resolve(baseDir, asset.source.data)
      if (!fs.existsSync(dataPath)) {
        errors.push(`Asset "${asset.id}": Data file not found at ${dataPath}`)
      } else {
        dataBuf = fs.readFileSync(dataPath)
        const dataMeta = await sharp(dataBuf).metadata()
        if (dataMeta.width !== width || dataMeta.height !== height) {
          errors.push(`Asset "${asset.id}": Data dimensions (${dataMeta.width}x${dataMeta.height}) mismatch Albedo (${width}x${height})`)
        }
      }
    }

    if (asset.anchorPx.x > width || asset.anchorPx.y > height) {
      errors.push(`Asset "${asset.id}": anchorPx (${asset.anchorPx.x}, ${asset.anchorPx.y}) exceeds un-trimmed bounds (${width}x${height})`)
    }

    validatedAssets.push({
      raw: asset,
      albedoBuf,
      normalBuf,
      dataBuf,
      width,
      height
    })
  }

  if (errors.length > 0 || validateOnly) {
    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      assetsCount: validatedAssets.length
    }
  }

  // Step 2: Synchronous Alpha Trim & Extrusion
  interface ProcessedAsset {
    id: string
    layer: RawAssetManifest['assets'][number]['layer']
    trimmedW: number
    trimmedH: number
    anchor: { x: number; y: number }
    overhang?: VisualAssetFrame['overhang']
    footprint?: VisualAssetFrame['footprint']
    sockets?: VisualAssetFrame['sockets']
    albedoExtruded: Buffer
    normalExtruded: Buffer
    dataExtruded: Buffer
  }

  const processedAssets: ProcessedAsset[] = []

  for (const item of validatedAssets) {
    const trimBox = await computeAlphaTrim(item.albedoBuf)

    // Crop Albedo
    const albedoCropped = await sharp(item.albedoBuf)
      .extract({ left: trimBox.left, top: trimBox.top, width: trimBox.width, height: trimBox.height })
      .png()
      .toBuffer()

    // Crop or generate Normal (default neutral normal RGB: 128, 128, 255)
    let normalCropped: Buffer
    if (item.normalBuf) {
      normalCropped = await sharp(item.normalBuf)
        .extract({ left: trimBox.left, top: trimBox.top, width: trimBox.width, height: trimBox.height })
        .png()
        .toBuffer()
    } else {
      normalCropped = await createSolidColorBuffer(trimBox.width, trimBox.height, 128, 128, 255, 255)
    }

    // Crop or generate Data (default neutral data RGB: 0, 255, 0 -> 0 height, full AO, 0 emissive)
    let dataCropped: Buffer
    if (item.dataBuf) {
      dataCropped = await sharp(item.dataBuf)
        .extract({ left: trimBox.left, top: trimBox.top, width: trimBox.width, height: trimBox.height })
        .png()
        .toBuffer()
    } else {
      dataCropped = await createSolidColorBuffer(trimBox.width, trimBox.height, 0, 255, 0, 255)
    }

    // Extrude 2px edges
    const albedoExt = await extrudeImage(albedoCropped, profile.extrude)
    const normalExt = await extrudeImage(normalCropped, profile.extrude)
    const dataExt = await extrudeImage(dataCropped, profile.extrude)

    // Recalculate anchor [0..1] relative to trimmed sprite
    const runtimeAnchorX = Math.max(0, Math.min(1, (item.raw.anchorPx.x - trimBox.left) / trimBox.width))
    const runtimeAnchorY = Math.max(0, Math.min(1, (item.raw.anchorPx.y - trimBox.top) / trimBox.height))

    processedAssets.push({
      id: item.raw.id,
      layer: item.raw.layer,
      trimmedW: trimBox.width,
      trimmedH: trimBox.height,
      anchor: {
        x: Number(runtimeAnchorX.toFixed(4)),
        y: Number(runtimeAnchorY.toFixed(4))
      },
      overhang: item.raw.overhangPx,
      footprint: item.raw.footprint,
      sockets: item.raw.sockets,
      albedoExtruded: albedoExt.buffer,
      normalExtruded: normalExt.buffer,
      dataExtruded: dataExt.buffer
    })
  }

  // Step 3: Deterministic Bin Packing
  const packInputs = processedAssets.map(a => ({
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

  // Step 4: Composite Atlas Pages
  const compiledAssets: Record<string, VisualAssetFrame> = {}
  const pagesMetadata: MapAssetManifest['pages'] = []

  if (!dryRun && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  for (let pageIdx = 0; pageIdx < pagesCount; pageIdx++) {
    const pageId = `terrain-${pageIdx}`
    const pageAssets = processedAssets.filter(a => placementMap.get(a.id)?.page === pageIdx)

    const albedoComposites: OverlayOptions[] = []
    const normalComposites: OverlayOptions[] = []
    const dataComposites: OverlayOptions[] = []

    for (const asset of pageAssets) {
      const placement = placementMap.get(asset.id)!
      // Center in extruded slot
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
        sockets: asset.sockets,
        layer: asset.layer
      }
    }

    const albedoFileName = `terrain-albedo-${pageIdx}.webp`
    const normalFileName = `terrain-normal-${pageIdx}.png`
    const dataFileName = `terrain-data-${pageIdx}.png`

    if (!dryRun) {
      // Albedo page (WebP lossless)
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

      // Data page (RGBA lossless PNG: R=Height, G=AO, B=Emissive)
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
    version: 1,
    profile,
    pages: pagesMetadata,
    assets: compiledAssets
  }

  // Validate output against MapAssetManifestSchema
  const manifestValidation = MapAssetManifestSchema.safeParse(finalManifest)
  if (!manifestValidation.success) {
    return {
      success: false,
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

  if (report) {
    console.log(`\n=== Mars Map Asset Compilation Report ===`)
    console.log(`Assets processed: ${processedAssets.length}`)
    console.log(`Atlas pages: ${pagesCount} (${profile.atlasPageSize}x${profile.atlasPageSize})`)
    console.log(`Extrusion: ${profile.extrude}px, Padding: ${profile.padding}px`)
    console.log(`Output: ${outputDir}/terrain-manifest.json`)
    console.log(`=========================================\n`)
  }

  return {
    success: true,
    manifest: finalManifest,
    pagesCount,
    assetsCount: processedAssets.length
  }
}

// CLI entry point
if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.endsWith('compile-map-assets.ts'))) {
  const args = process.argv.slice(2)
  const isValidate = args.includes('--validate')
  const isDryRun = args.includes('--dry-run')
  const isReport = args.includes('--report') || true

  const inputManifestArg = args.find(a => a.startsWith('--input='))?.split('=')[1] ||
    path.join(process.cwd(), 'assets', 'raw_renders', 'raw_manifest.json')
  const outputDirArg = args.find(a => a.startsWith('--output='))?.split('=')[1] ||
    path.join(process.cwd(), 'public', 'assets', 'map')

  compileMapAssets({
    inputManifestPath: inputManifestArg,
    outputDir: outputDirArg,
    validateOnly: isValidate,
    dryRun: isDryRun,
    report: isReport
  }).then(result => {
    if (!result.success) {
      console.error('Compilation failed with errors:', result.errors)
      process.exit(1)
    }
    console.log('Compilation succeeded!')
  }).catch(err => {
    console.error('Fatal compiler error:', err)
    process.exit(1)
  })
}
