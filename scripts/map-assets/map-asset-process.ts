import sharp from 'sharp'
import type { ValidatedRawAsset } from './map-asset-input'
import { computeAlphaTrim, extrudeImage } from './map-asset-packer'
import type { VisualAssetFrame } from '../../src/components/map/mars-map-asset.types'

export interface ProcessedAsset {
  id: string
  layer: ValidatedRawAsset['raw']['layer']
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

export interface ProcessResult {
  success: boolean
  processedAssets?: ProcessedAsset[]
  errors: string[]
}

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
 * Trims, extrudes, and calculates precise runtime anchor for validated raw assets.
 */
export async function processRawAssets(
  assets: ValidatedRawAsset[],
  extrude: number
): Promise<ProcessResult> {
  const errors: string[] = []
  const processedAssets: ProcessedAsset[] = []

  for (const item of assets) {
    const trimBox = await computeAlphaTrim(item.albedoBuf)

    if (!trimBox) {
      errors.push(`Asset "${item.raw.id}": Albedo contains no visible (alpha > 0) pixels`)
      continue
    }

    // Exact anchor verification without silent clamping
    const rawAnchorX = item.raw.anchorPx.x
    const rawAnchorY = item.raw.anchorPx.y

    const runtimeAnchorX = (rawAnchorX - trimBox.left) / trimBox.width
    const runtimeAnchorY = (rawAnchorY - trimBox.top) / trimBox.height

    if (runtimeAnchorX < 0 || runtimeAnchorX > 1 || runtimeAnchorY < 0 || runtimeAnchorY > 1) {
      errors.push(
        `Asset "${item.raw.id}": raw anchorPx (${rawAnchorX}, ${rawAnchorY}) is outside trimmed sprite bbox ` +
        `[left: ${trimBox.left}..${trimBox.left + trimBox.width}, top: ${trimBox.top}..${trimBox.top + trimBox.height}]`
      )
      continue
    }

    // Crop Albedo
    const albedoCropped = await sharp(item.albedoBuf)
      .extract({ left: trimBox.left, top: trimBox.top, width: trimBox.width, height: trimBox.height })
      .png()
      .toBuffer()

    // Crop or generate Normal
    let normalCropped: Buffer
    if (item.normalBuf) {
      normalCropped = await sharp(item.normalBuf)
        .extract({ left: trimBox.left, top: trimBox.top, width: trimBox.width, height: trimBox.height })
        .png()
        .toBuffer()
    } else {
      normalCropped = await createSolidColorBuffer(trimBox.width, trimBox.height, 128, 128, 255, 255)
    }

    // Crop or generate Data
    let dataCropped: Buffer
    if (item.dataBuf) {
      dataCropped = await sharp(item.dataBuf)
        .extract({ left: trimBox.left, top: trimBox.top, width: trimBox.width, height: trimBox.height })
        .png()
        .toBuffer()
    } else {
      dataCropped = await createSolidColorBuffer(trimBox.width, trimBox.height, 0, 255, 0, 255)
    }

    // Extrude edges
    const albedoExt = await extrudeImage(albedoCropped, extrude)
    const normalExt = await extrudeImage(normalCropped, extrude)
    const dataExt = await extrudeImage(dataCropped, extrude)

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

  return {
    success: errors.length === 0,
    processedAssets: errors.length === 0 ? processedAssets : undefined,
    errors
  }
}
