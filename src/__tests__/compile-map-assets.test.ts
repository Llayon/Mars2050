import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import sharp from 'sharp'
import { compileMapAssets } from '../../scripts/compile-map-assets'
import { MapAssetManifestSchema } from '@/components/map/mars-map-asset.types'
import type { RawAssetManifest } from '@/components/map/mars-map-raw.types'

describe('compile-map-assets (Stage 2 End-to-End Compiler Pipeline)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mars-compile-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  function sha256(filePath: string): string {
    const fileBuf = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(fileBuf).digest('hex')
  }

  it('compiles multi-channel raw manifest end-to-end with authoritative profile, synchronous trim, and SHA256 repeatability', async () => {
    const rawRendersDir = path.join(tmpDir, 'raw_renders')
    const outputDirA = path.join(tmpDir, 'output_a')
    const outputDirB = path.join(tmpDir, 'output_b')
    fs.mkdirSync(rawRendersDir, { recursive: true })

    // Create synthetic 200x200 albedo with 100x100 solid box at (50, 40) -> raw pivot at (100, 90)
    const albedoData = Buffer.alloc(200 * 200 * 4)
    for (let y = 40; y < 140; y++) {
      for (let x = 50; x < 150; x++) {
        const idx = (y * 200 + x) * 4
        albedoData[idx] = 200
        albedoData[idx + 1] = 100
        albedoData[idx + 2] = 50
        albedoData[idx + 3] = 255
      }
    }
    const albedoBuf = await sharp(albedoData, { raw: { width: 200, height: 200, channels: 4 } }).png().toBuffer()
    fs.writeFileSync(path.join(rawRendersDir, 'crater.albedo.png'), albedoBuf)

    const normalBuf = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 128, g: 128, b: 255, alpha: 255 } } }).png().toBuffer()
    fs.writeFileSync(path.join(rawRendersDir, 'crater.normal.png'), normalBuf)

    const dataBuf = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 50, g: 200, b: 0, alpha: 255 } } }).png().toBuffer()
    fs.writeFileSync(path.join(rawRendersDir, 'crater.data.png'), dataBuf)

    const profilePath = path.join(tmpDir, 'map-render-profile.json')
    fs.writeFileSync(profilePath, JSON.stringify({
      version: 1, projection: 'orthographic', hexOrientation: 'pointy',
      cameraPitch: 60, cameraYaw: 30, orthoScale: 12, tileWorldRadius: 64, pixelsPerWorldUnit: 2,
      sunAzimuth: 135, sunElevation: 35, atlasPageSize: 512, padding: 4, extrude: 2, mipmaps: false
    }))

    const rawManifest: RawAssetManifest = {
      version: 1,
      assets: [
        {
          id: 'crater-01',
          layer: 'macro',
          source: { albedo: 'crater.albedo.png', normal: 'crater.normal.png', data: 'crater.data.png' },
          anchorPx: { x: 100, y: 90 },
          footprint: [{ q: 0, r: 0 }],
          sockets: ['cliff', 'ground', 'ground', 'cliff', 'ground', 'ground'],
          overhangPx: { top: 20, right: 10, bottom: 5, left: 10 }
        }
      ]
    }

    const rawManifestPath = path.join(rawRendersDir, 'raw_manifest.json')
    fs.writeFileSync(rawManifestPath, JSON.stringify(rawManifest, null, 2))

    const resultA = await compileMapAssets({
      inputManifestPath: rawManifestPath,
      profilePath,
      outputDir: outputDirA,
      report: false
    })

    expect(resultA.success).toBe(true)
    expect(resultA.assetsCount).toBe(1)
    expect(resultA.pagesCount).toBe(1)

    const resultB = await compileMapAssets({
      inputManifestPath: rawManifestPath,
      profilePath,
      outputDir: outputDirB,
      report: false
    })

    expect(resultB.success).toBe(true)

    // Verify SHA256 repeatability across runs
    expect(sha256(path.join(outputDirA, 'terrain-manifest.json'))).toBe(sha256(path.join(outputDirB, 'terrain-manifest.json')))
    expect(sha256(path.join(outputDirA, 'terrain-albedo-0.webp'))).toBe(sha256(path.join(outputDirB, 'terrain-albedo-0.webp')))
    expect(sha256(path.join(outputDirA, 'terrain-normal-0.png'))).toBe(sha256(path.join(outputDirB, 'terrain-normal-0.png')))
    expect(sha256(path.join(outputDirA, 'terrain-data-0.png'))).toBe(sha256(path.join(outputDirB, 'terrain-data-0.png')))

    const manifestJson = JSON.parse(fs.readFileSync(path.join(outputDirA, 'terrain-manifest.json'), 'utf-8'))
    const parsed = MapAssetManifestSchema.safeParse(manifestJson)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const asset = parsed.data.assets['crater-01']
      expect(asset.id).toBe('crater-01')
      expect(asset.anchor).toEqual({ x: 0.5, y: 0.5 })
      expect(asset.frame.w).toBe(100)
      expect(asset.frame.h).toBe(100)
    }
  })

  it('fails with hard error if Albedo is fully transparent', async () => {
    const rawRendersDir = path.join(tmpDir, 'raw_empty')
    fs.mkdirSync(rawRendersDir, { recursive: true })

    const emptyAlbedo = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    fs.writeFileSync(path.join(rawRendersDir, 'empty.albedo.png'), emptyAlbedo)

    const profilePath = path.join(tmpDir, 'profile.json')
    fs.writeFileSync(profilePath, JSON.stringify({
      version: 1, projection: 'orthographic', hexOrientation: 'pointy',
      cameraPitch: 60, cameraYaw: 30, orthoScale: 12, tileWorldRadius: 64, pixelsPerWorldUnit: 2,
      sunAzimuth: 135, sunElevation: 35, atlasPageSize: 512, padding: 4, extrude: 2, mipmaps: false
    }))

    const rawManifest: RawAssetManifest = {
      version: 1,
      assets: [{
        id: 'empty-sprite',
        layer: 'ground',
        source: { albedo: 'empty.albedo.png' },
        anchorPx: { x: 50, y: 50 }
      }]
    }

    const rawManifestPath = path.join(rawRendersDir, 'raw_manifest.json')
    fs.writeFileSync(rawManifestPath, JSON.stringify(rawManifest, null, 2))

    const result = await compileMapAssets({
      inputManifestPath: rawManifestPath,
      profilePath,
      outputDir: path.join(tmpDir, 'out')
    })

    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Albedo contains no visible (alpha > 0) pixels')
  })

  it('fails with hard error if raw anchorPx is outside trimmed bbox', async () => {
    const rawRendersDir = path.join(tmpDir, 'raw_anchor_oob')
    fs.mkdirSync(rawRendersDir, { recursive: true })

    const albedoData = Buffer.alloc(100 * 100 * 4)
    for (let y = 40; y < 80; y++) {
      for (let x = 40; x < 80; x++) {
        const idx = (y * 100 + x) * 4
        albedoData[idx] = 255
        albedoData[idx + 3] = 255
      }
    }
    const albedoBuf = await sharp(albedoData, { raw: { width: 100, height: 100, channels: 4 } }).png().toBuffer()
    fs.writeFileSync(path.join(rawRendersDir, 'box.albedo.png'), albedoBuf)

    const profilePath = path.join(tmpDir, 'profile.json')
    fs.writeFileSync(profilePath, JSON.stringify({
      version: 1, projection: 'orthographic', hexOrientation: 'pointy',
      cameraPitch: 60, cameraYaw: 30, orthoScale: 12, tileWorldRadius: 64, pixelsPerWorldUnit: 2,
      sunAzimuth: 135, sunElevation: 35, atlasPageSize: 512, padding: 4, extrude: 2, mipmaps: false
    }))

    const rawManifest: RawAssetManifest = {
      version: 1,
      assets: [{
        id: 'bad-anchor-sprite',
        layer: 'macro',
        source: { albedo: 'box.albedo.png' },
        anchorPx: { x: 20, y: 20 }
      }]
    }

    const rawManifestPath = path.join(rawRendersDir, 'raw_manifest.json')
    fs.writeFileSync(rawManifestPath, JSON.stringify(rawManifest, null, 2))

    const result = await compileMapAssets({
      inputManifestPath: rawManifestPath,
      profilePath,
      outputDir: path.join(tmpDir, 'out')
    })

    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('raw anchorPx (20, 20) is outside trimmed sprite bbox')
  })

  it('fails with clear error if companion dimensions mismatch', async () => {
    const rawRendersDir = path.join(tmpDir, 'raw_mismatch')
    fs.mkdirSync(rawRendersDir, { recursive: true })

    const albedoBuf = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 255 } } }).png().toBuffer()
    const badNormalBuf = await sharp({ create: { width: 80, height: 80, channels: 4, background: { r: 128, g: 128, b: 255, alpha: 255 } } }).png().toBuffer()

    fs.writeFileSync(path.join(rawRendersDir, 'tile.albedo.png'), albedoBuf)
    fs.writeFileSync(path.join(rawRendersDir, 'tile.normal.png'), badNormalBuf)

    const profilePath = path.join(tmpDir, 'profile.json')
    fs.writeFileSync(profilePath, JSON.stringify({
      version: 1, projection: 'orthographic', hexOrientation: 'pointy',
      cameraPitch: 60, cameraYaw: 30, orthoScale: 12, tileWorldRadius: 64, pixelsPerWorldUnit: 2,
      sunAzimuth: 135, sunElevation: 35, atlasPageSize: 512, padding: 4, extrude: 2, mipmaps: false
    }))

    const rawManifest: RawAssetManifest = {
      version: 1,
      assets: [{
        id: 'bad-tile',
        layer: 'ground',
        source: { albedo: 'tile.albedo.png', normal: 'tile.normal.png' },
        anchorPx: { x: 50, y: 50 }
      }]
    }

    const rawManifestPath = path.join(rawRendersDir, 'raw_manifest.json')
    fs.writeFileSync(rawManifestPath, JSON.stringify(rawManifest, null, 2))

    const result = await compileMapAssets({
      inputManifestPath: rawManifestPath,
      profilePath,
      outputDir: path.join(tmpDir, 'out')
    })

    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Normal dimensions (80x80) mismatch Albedo (100x100)')
  })
})
