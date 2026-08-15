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
 * Loads authoritative profile and raw manifest, verifying file existence and companion dimensions.
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

  return {
    success: errors.length === 0,
    profile,
    rawManifest,
    validatedAssets,
    errors
  }
}
