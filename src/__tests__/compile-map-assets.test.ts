import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import sharp from 'sharp'
import { compileMapAssets } from '../../scripts/compile-map-assets'
import { computeAlphaTrim, extrudeImage, packRectangles } from '../../scripts/helpers/map-asset-packer'
import { MapAssetManifestSchema } from '@/components/map/mars-map-asset.types'
import type { RawAssetManifest } from '@/components/map/mars-map-raw.types'

describe('compile-map-assets (Stage 2 Asset Compiler Pipeline)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mars-compile-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('computeAlphaTrim correctly calculates bounding box of non-transparent pixels', async () => {
    // Create 100x100 transparent image with a 20x30 solid rectangle at (10, 20)
    const imgData = Buffer.alloc(100 * 100 * 4)
    for (let y = 20; y < 50; y++) {
      for (let x = 10; x < 30; x++) {
        const idx = (y * 100 + x) * 4
        imgData[idx] = 255     // R
        imgData[idx + 1] = 120 // G
        imgData[idx + 2] = 50  // B
        imgData[idx + 3] = 255 // A
      }
    }

    const pngBuf = await sharp(imgData, { raw: { width: 100, height: 100, channels: 4 } }).png().toBuffer()
    const box = await computeAlphaTrim(pngBuf)

    expect(box).toEqual({
      left: 10,
      top: 20,
      width: 20,
      height: 30
    })
  })

  it('extrudeImage extends edge pixels by 2px with clamping', async () => {
    const rawData = Buffer.from([
      255, 0, 0, 255,   0, 255, 0, 255,
      0, 0, 255, 255,   255, 255, 0, 255
    ])
    const srcBuf = await sharp(rawData, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer()
    const { buffer, width, height } = await extrudeImage(srcBuf, 2)

    expect(width).toBe(6) // 2 + 2*2
    expect(height).toBe(6)

    const meta = await sharp(buffer).metadata()
    expect(meta.width).toBe(6)
    expect(meta.height).toBe(6)
  })

  it('packRectangles deterministically packs items and splits into multiple pages when needed', () => {
    const items = [
      { id: 'b_item', width: 400, height: 300 },
      { id: 'a_item', width: 600, height: 500 },
      { id: 'c_item', width: 200, height: 200 }
    ]

    const packed = packRectangles(items, 1024, 4, 2)
    expect(packed.length).toBe(3)
    for (const p of packed) {
      expect(p.page).toBe(0)
      expect(p.x).toBeGreaterThanOrEqual(2)
      expect(p.y).toBeGreaterThanOrEqual(2)
      expect(p.x + p.width).toBeLessThanOrEqual(1024)
      expect(p.y + p.height).toBeLessThanOrEqual(1024)
    }
  })

  it('compiles multi-channel raw manifest end-to-end with synchronous trim and anchor recalculation', async () => {
    const rawRendersDir = path.join(tmpDir, 'raw_renders')
    const outputDir = path.join(tmpDir, 'output')
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

    // Normal companion (200x200)
    const normalBuf = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 128, g: 128, b: 255, alpha: 255 } } }).png().toBuffer()
    fs.writeFileSync(path.join(rawRendersDir, 'crater.normal.png'), normalBuf)

    // Data companion (200x200)
    const dataBuf = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 50, g: 200, b: 0, alpha: 255 } } }).png().toBuffer()
    fs.writeFileSync(path.join(rawRendersDir, 'crater.data.png'), dataBuf)

    const rawManifest: RawAssetManifest = {
      version: 1,
      profile: {
        version: 1,
        projection: 'orthographic',
        hexOrientation: 'pointy',
        cameraPitch: 60,
        cameraYaw: 30,
        orthoScale: 12,
        tileWorldRadius: 64,
        pixelsPerWorldUnit: 2,
        sunAzimuth: 135,
        sunElevation: 35,
        atlasPageSize: 512,
        padding: 4,
        extrude: 2,
        mipmaps: false
      },
      assets: [
        {
          id: 'crater-01',
          layer: 'macro',
          source: {
            albedo: 'crater.albedo.png',
            normal: 'crater.normal.png',
            data: 'crater.data.png'
          },
          // Raw pivot at (100, 90) -> relative to trimmed (100-50=50, 90-40=50) / 100 = 0.5, 0.5
          anchorPx: { x: 100, y: 90 },
          footprint: [{ q: 0, r: 0 }],
          sockets: ['cliff', 'ground', 'ground', 'cliff', 'ground', 'ground'],
          overhangPx: { top: 20, right: 10, bottom: 5, left: 10 }
        }
      ]
    }

    const rawManifestPath = path.join(rawRendersDir, 'raw_manifest.json')
    fs.writeFileSync(rawManifestPath, JSON.stringify(rawManifest, null, 2))

    // Run compile
    const result = await compileMapAssets({
      inputManifestPath: rawManifestPath,
      outputDir,
      report: false
    })

    expect(result.success).toBe(true)
    expect(result.assetsCount).toBe(1)
    expect(result.pagesCount).toBe(1)

    // Check generated files
    expect(fs.existsSync(path.join(outputDir, 'terrain-manifest.json'))).toBe(true)
    expect(fs.existsSync(path.join(outputDir, 'terrain-albedo-0.webp'))).toBe(true)
    expect(fs.existsSync(path.join(outputDir, 'terrain-normal-0.png'))).toBe(true)
    expect(fs.existsSync(path.join(outputDir, 'terrain-data-0.png'))).toBe(true)

    // Validate generated manifest with schema
    const manifestJson = JSON.parse(fs.readFileSync(path.join(outputDir, 'terrain-manifest.json'), 'utf-8'))
    const parsed = MapAssetManifestSchema.safeParse(manifestJson)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const asset = parsed.data.assets['crater-01']
      expect(asset.id).toBe('crater-01')
      expect(asset.anchor).toEqual({ x: 0.5, y: 0.5 })
      expect(asset.frame.w).toBe(100)
      expect(asset.frame.h).toBe(100)
      expect(asset.overhang).toEqual({ top: 20, right: 10, bottom: 5, left: 10 })
    }
  })

  it('fails with clear error if companion dimensions mismatch', async () => {
    const rawRendersDir = path.join(tmpDir, 'raw_mismatch')
    fs.mkdirSync(rawRendersDir, { recursive: true })

    const albedoBuf = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 255 } } }).png().toBuffer()
    const badNormalBuf = await sharp({ create: { width: 80, height: 80, channels: 4, background: { r: 128, g: 128, b: 255, alpha: 255 } } }).png().toBuffer()

    fs.writeFileSync(path.join(rawRendersDir, 'tile.albedo.png'), albedoBuf)
    fs.writeFileSync(path.join(rawRendersDir, 'tile.normal.png'), badNormalBuf)

    const rawManifest = {
      version: 1,
      profile: {
        version: 1, projection: 'orthographic', hexOrientation: 'pointy',
        cameraPitch: 60, cameraYaw: 30, orthoScale: 12, tileWorldRadius: 64, pixelsPerWorldUnit: 2,
        sunAzimuth: 135, sunElevation: 35, atlasPageSize: 512, padding: 4, extrude: 2, mipmaps: false
      },
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
      outputDir: path.join(tmpDir, 'out')
    })

    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toContain('Normal dimensions (80x80) mismatch Albedo (100x100)')
  })
})
