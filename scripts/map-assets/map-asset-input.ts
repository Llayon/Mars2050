import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { MapRenderProfileSchema, type MapRenderProfile } from '../../src/components/map/mars-map-asset.types'
import { RawAssetManifestSchema, type RawAssetManifest } from '../../src/components/map/mars-map-raw.types'

export interface ValidatedRawAsset {
  raw: RawAssetManifest['assets'][number]
  albedoBuf: Buffer
  normalBuf: Buffer | null
  dataBuf: Buffer | null
  width: number
  height: number
}

export interface InputLoadResult {
  success: boolean
  profile?: MapRenderProfile
  rawManifest?: RawAssetManifest
  validatedAssets?: ValidatedRawAsset[]
  errors: string[]
}

/**
 * Validates normal map pixel semantics: unit length on opaque pixels and variance on non-flat assets.
 */
export async function validateNormalSemantics(
  assetId: string,
  normalBuf: Buffer,
  errors: string[]
): Promise<void> {
  const { data, info } = await sharp(normalBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const totalPixels = info.width * info.height

  let opaqueCount = 0
  let validUnitCount = 0
  let positiveZCount = 0
  let sumNz = 0
  let minNx = 1.0, maxNx = -1.0
  let minNy = 1.0, maxNy = -1.0

  // Deterministically sample every 4th pixel to remain performant yet thorough
  const step = 4
  for (let i = 0; i < totalPixels; i += step) {
    const offset = i * 4
    const a = data[offset + 3]
    if (a < 254) continue // Skip anti-aliased edge pixels

    opaqueCount++
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]

    const nx = (r / 255) * 2 - 1
    const ny = (g / 255) * 2 - 1
    const nz = (b / 255) * 2 - 1

    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (len >= 0.80 && len <= 1.20) {
      validUnitCount++
    }

    if (nz >= -0.05) {
      positiveZCount++
    }
    sumNz += nz

    if (nx < minNx) minNx = nx
    if (nx > maxNx) maxNx = nx
    if (ny < minNy) minNy = ny
    if (ny > maxNy) maxNy = ny
  }

  if (opaqueCount <= 10) {
    errors.push(
      `Asset "${assetId}": Normal map has insufficient opaque pixel samples for validation (${opaqueCount} found).`
    )
    return
  }

  const validRatio = validUnitCount / opaqueCount
  if (validRatio < 0.98) {
    errors.push(
      `Asset "${assetId}": Normal map failed unit-vector validation (${(validRatio * 100).toFixed(1)}% valid, expected >= 98.0%). Ensure Raw/Non-Color color management is used.`
    )
  }

  const positiveZRatio = positiveZCount / opaqueCount
  const meanNz = sumNz / opaqueCount
  if (positiveZRatio < 0.95 || meanNz < 0.20) {
    errors.push(
      `Asset "${assetId}": Normal map failed toward-camera (+Z) orientation calibration (positiveZRatio: ${(positiveZRatio * 100).toFixed(1)}%, meanNz: ${meanNz.toFixed(3)}). ` +
      `Expected normals pointing toward camera (+Z, neutral 128,128,255). Ensure view-space Z inversion is applied in Blender factory.`
    )
  }

  // Check non-flat assets have normal variation
  const nonFlatAssets = ['crater_medium_02', 'ridge_01', 'boulder_cluster_01']
  if (nonFlatAssets.includes(assetId)) {
    const variation = (maxNx - minNx) + (maxNy - minNy)
    if (variation < 0.05) {
      errors.push(`Asset "${assetId}": Normal map is flat/constant (${variation.toFixed(3)} variation), expected 3D relief.`)
    }
  }
}

/**
 * Validates data map pixel semantics: height/AO variation on non-flat assets, emissive approx 0.
 */
export async function validateDataSemantics(
  assetId: string,
  dataBuf: Buffer,
  errors: string[]
): Promise<void> {
  const { data, info } = await sharp(dataBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const totalPixels = info.width * info.height

  let opaqueCount = 0
  let maxEmissive = 0
  let minHeight = 255, maxHeight = 0
  let minAo = 255, maxAo = 0

  const step = 4
  for (let i = 0; i < totalPixels; i += step) {
    const offset = i * 4
    const a = data[offset + 3]
    if (a < 254) continue // Skip anti-aliased edge pixels

    opaqueCount++
    const r = data[offset]     // Height
    const g = data[offset + 1] // AO
    const b = data[offset + 2] // Emissive

    if (b > maxEmissive) maxEmissive = b
    if (r < minHeight) minHeight = r
    if (r > maxHeight) maxHeight = r
    if (g < minAo) minAo = g
    if (g > maxAo) maxAo = g
  }

  if (opaqueCount <= 10) {
    errors.push(
      `Asset "${assetId}": Data map has insufficient opaque pixel samples for validation (${opaqueCount} found).`
    )
    return
  }

  if (maxEmissive > 15) {
    errors.push(`Asset "${assetId}": Data map has unexpected emissive values in terrain (max B=${maxEmissive}, expected <= 15).`)
  }

  const nonFlatAssets = ['crater_medium_02', 'ridge_01']
  if (nonFlatAssets.includes(assetId)) {
    if (maxHeight - minHeight < 10) {
      errors.push(`Asset "${assetId}": Data map height channel lacks variation (range ${maxHeight - minHeight}).`)
    }
    if (maxAo - minAo < 10) {
      errors.push(`Asset "${assetId}": Data map AO channel lacks variation (range ${maxAo - minAo}).`)
    }
  }
}

/**
 * Loads authoritative profile and raw manifest, verifying file existence, companion dimensions, and pixel semantics.
 */
export async function loadAndValidateInputs(
  profilePath: string,
  manifestPath: string,
  baseDir: string = path.dirname(manifestPath)
): Promise<InputLoadResult> {
  const errors: string[] = []

  // 1. Authoritative Render Profile
  if (!fs.existsSync(profilePath)) {
    return { success: false, errors: [`Authoritative render profile not found at ${profilePath}`] }
  }
  const profileJson = JSON.parse(fs.readFileSync(profilePath, 'utf-8'))
  const parsedProfile = MapRenderProfileSchema.safeParse(profileJson)
  if (!parsedProfile.success) {
    return {
      success: false,
      errors: parsedProfile.error.issues.map(i => `Profile schema error [${i.path.join('.')}]: ${i.message}`)
    }
  }
  const profile = parsedProfile.data

  // 2. Raw Manifest
  if (!fs.existsSync(manifestPath)) {
    return { success: false, errors: [`Raw manifest not found at ${manifestPath}`] }
  }
  const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const parsedManifest = RawAssetManifestSchema.safeParse(manifestJson)
  if (!parsedManifest.success) {
    return {
      success: false,
      errors: parsedManifest.error.issues.map(i => `Raw manifest error [${i.path.join('.')}]: ${i.message}`)
    }
  }
  const rawManifest = parsedManifest.data

  // 3. Validate Companion Textures
  const validatedAssets: ValidatedRawAsset[] = []

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
        } else {
          await validateNormalSemantics(asset.id, normalBuf, errors)
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
        } else {
          await validateDataSemantics(asset.id, dataBuf, errors)
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

  return {
    success: errors.length === 0,
    profile,
    rawManifest,
    validatedAssets,
    errors
  }
}
