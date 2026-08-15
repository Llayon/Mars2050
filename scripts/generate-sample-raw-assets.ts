import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import type { RawAssetManifest } from '../src/components/map/mars-map-raw.types'

async function generateSampleRawAssets() {
  const outputDir = path.join(process.cwd(), 'assets', 'raw_renders')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Helper to create circular/hexagonal patterned sample sprite
  async function createSampleTile(
    fileNamePrefix: string,
    width: number,
    height: number,
    drawShape: (x: number, y: number) => { r: number; g: number; b: number; a: number; nx?: number; ny?: number; nz?: number; heightVal?: number; ao?: number; emissive?: number }
  ) {
    const albedoData = Buffer.alloc(width * height * 4)
    const normalData = Buffer.alloc(width * height * 4)
    const dataData = Buffer.alloc(width * height * 4)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const pixel = drawShape(x, y)

        albedoData[idx] = pixel.r
        albedoData[idx + 1] = pixel.g
        albedoData[idx + 2] = pixel.b
        albedoData[idx + 3] = pixel.a

        normalData[idx] = pixel.nx ?? 128
        normalData[idx + 1] = pixel.ny ?? 128
        normalData[idx + 2] = pixel.nz ?? 255
        normalData[idx + 3] = pixel.a > 0 ? 255 : 0

        dataData[idx] = pixel.heightVal ?? 0
        dataData[idx + 1] = pixel.ao ?? 255
        dataData[idx + 2] = pixel.emissive ?? 0
        dataData[idx + 3] = pixel.a > 0 ? 255 : 0
      }
    }

    await sharp(albedoData, { raw: { width, height, channels: 4 } }).png().toFile(path.join(outputDir, `${fileNamePrefix}.albedo.png`))
    await sharp(normalData, { raw: { width, height, channels: 4 } }).png().toFile(path.join(outputDir, `${fileNamePrefix}.normal.png`))
    await sharp(dataData, { raw: { width, height, channels: 4 } }).png().toFile(path.join(outputDir, `${fileNamePrefix}.data.png`))
  }

  // 1. Regolith Plain (256x256 with 220x190 hex-like ellipse at center)
  await createSampleTile('regolith_plain_01', 256, 256, (x, y) => {
    const dx = (x - 128) / 100
    const dy = (y - 128) / 80
    const dist = dx * dx + dy * dy
    if (dist <= 1.0) {
      const edgeFade = Math.min(1, (1.0 - dist) * 10)
      return {
        r: 180 + Math.floor(Math.sin(x * 0.1) * 20),
        g: 90 + Math.floor(Math.cos(y * 0.1) * 15),
        b: 50,
        a: Math.floor(255 * edgeFade),
        nx: 128 + Math.floor(dx * 30),
        ny: 128 + Math.floor(dy * 30),
        nz: 240,
        heightVal: Math.floor(30 * (1 - dist)),
        ao: 240,
        emissive: 0
      }
    }
    return { r: 0, g: 0, b: 0, a: 0 }
  })

  // 2. Crater Medium (256x256)
  await createSampleTile('crater_medium_01', 256, 256, (x, y) => {
    const dx = (x - 128) / 90
    const dy = (y - 128) / 70
    const dist = dx * dx + dy * dy
    if (dist <= 1.0) {
      const rim = Math.abs(dist - 0.6) < 0.2
      const inner = dist < 0.4
      return {
        r: rim ? 210 : inner ? 110 : 160,
        g: rim ? 110 : inner ? 50 : 80,
        b: rim ? 60 : inner ? 30 : 40,
        a: 255,
        nx: 128 + Math.floor(dx * 60),
        ny: 128 + Math.floor(dy * 60),
        nz: 220,
        heightVal: rim ? 180 : inner ? 20 : 80,
        ao: inner ? 100 : 230,
        emissive: 0
      }
    }
    return { r: 0, g: 0, b: 0, a: 0 }
  })

  // 3. Cliff Ridge (256x256)
  await createSampleTile('cliff_ridge_01', 256, 256, (x, y) => {
    const dx = (x - 128) / 110
    const dy = (y - 120) / 90
    const dist = dx * dx + dy * dy
    if (dist <= 1.0 && y > 60 && y < 200) {
      return {
        r: 140,
        g: 70,
        b: 40,
        a: 255,
        nx: 180,
        ny: 160,
        nz: 180,
        heightVal: 220,
        ao: 160,
        emissive: 0
      }
    }
    return { r: 0, g: 0, b: 0, a: 0 }
  })

  // 4. Rock Scatter (128x128)
  await createSampleTile('rock_scatter_01', 128, 128, (x, y) => {
    const dx = (x - 64) / 40
    const dy = (y - 64) / 30
    const dist = dx * dx + dy * dy
    if (dist <= 1.0) {
      return {
        r: 100,
        g: 90,
        b: 85,
        a: 255,
        nx: 140,
        ny: 140,
        nz: 230,
        heightVal: 150,
        ao: 180,
        emissive: 0
      }
    }
    return { r: 0, g: 0, b: 0, a: 0 }
  })

  const rawManifest: RawAssetManifest = {
    version: 2,
    assets: [
      {
        id: 'regolith_plain_01',
        layer: 'ground',
        source: {
          albedo: 'regolith_plain_01.albedo.png',
          normal: 'regolith_plain_01.normal.png',
          data: 'regolith_plain_01.data.png'
        },
        anchorPx: { x: 128, y: 128 },
        footprint: [{ x: 0, y: 0 }]
      },
      {
        id: 'crater_medium_01',
        layer: 'macro',
        source: {
          albedo: 'crater_medium_01.albedo.png',
          normal: 'crater_medium_01.normal.png',
          data: 'crater_medium_01.data.png'
        },
        anchorPx: { x: 128, y: 128 },
        footprint: [{ x: 0, y: 0 }],
        overhangPx: { top: 15, right: 10, bottom: 5, left: 10 }
      },
      {
        id: 'cliff_ridge_01',
        layer: 'macro',
        source: {
          albedo: 'cliff_ridge_01.albedo.png',
          normal: 'cliff_ridge_01.normal.png',
          data: 'cliff_ridge_01.data.png'
        },
        anchorPx: { x: 128, y: 130 },
        footprint: [{ x: 0, y: 0 }]
      },
      {
        id: 'rock_scatter_01',
        layer: 'scatter',
        source: {
          albedo: 'rock_scatter_01.albedo.png',
          normal: 'rock_scatter_01.normal.png',
          data: 'rock_scatter_01.data.png'
        },
        anchorPx: { x: 64, y: 64 }
      }
    ]
  }

  fs.writeFileSync(
    path.join(outputDir, 'raw_manifest.json'),
    JSON.stringify(rawManifest, null, 2),
    'utf-8'
  )

  console.log('Sample raw assets generated at assets/raw_renders/')
}

generateSampleRawAssets().catch(console.error)
