import { describe, it, expect } from 'vitest'
import { BufferImageSource, Rectangle, Sprite, Texture } from 'pixi.js'
import type { VisualAssetFrame } from '@/components/map/mars-map-asset.types'
import {
  createLitMeshGeometry,
  createTerrainRenderable,
  TerrainLightingContext
} from '@/components/map/mars-map-lit-mesh'
import type { LoadedMapAssets, RuntimeMapAsset } from '@/components/map/mars-map-render.types'

describe('mars-map-lit-mesh (Geometry & Factory)', () => {
  const frame: VisualAssetFrame = {
    id: 'crater-medium-01',
    page: 0,
    frame: { x: 100, y: 200, w: 100, h: 80 },
    anchor: { x: 0.25, y: 0.75 },
    layer: 'macro'
  }

  const dummySource = new BufferImageSource({
    resource: new Uint8Array(2048 * 2048 * 4),
    width: 2048,
    height: 2048
  })

  const dummyTexture = new Texture({
    source: dummySource,
    frame: new Rectangle(100, 200, 100, 80)
  })

  it('constructs anchor-aware quad geometry with exact vertex bounds', () => {
    const geo = createLitMeshGeometry(frame, dummyTexture)

    // Expected local vertex positions for 100x80 with anchor (0.25, 0.75):
    // left   = -0.25 * 100 = -25
    // right  = (1 - 0.25) * 100 = +75
    // top    = -0.75 * 80 = -60
    // bottom = (1 - 0.75) * 80 = +20
    const positions = Array.from(geo.positions)
    expect(positions).toEqual([
      -25, -60, // top-left
      75, -60,  // top-right
      75, 20,   // bottom-right
      -25, 20   // bottom-left
    ])

    // Indices: 2 triangles
    const indices = Array.from(geo.indices)
    expect(indices).toEqual([0, 1, 2, 0, 2, 3])

    // UVs should match texture UV coordinates
    const uvs = Array.from(geo.uvs)
    expect(uvs[0]).toBeCloseTo(dummyTexture.uvs.x0)
    expect(uvs[1]).toBeCloseTo(dummyTexture.uvs.y0)
    expect(uvs[2]).toBeCloseTo(dummyTexture.uvs.x1)
    expect(uvs[3]).toBeCloseTo(dummyTexture.uvs.y1)
    expect(uvs[4]).toBeCloseTo(dummyTexture.uvs.x2)
    expect(uvs[5]).toBeCloseTo(dummyTexture.uvs.y2)
    expect(uvs[6]).toBeCloseTo(dummyTexture.uvs.x3)
    expect(uvs[7]).toBeCloseTo(dummyTexture.uvs.y3)
  })

  it('creates baked Sprite when lightingMode is baked or lighting unavailable', () => {
    const mockAsset: RuntimeMapAsset = {
      texture: dummyTexture,
      frame
    }

    const mockAssets: LoadedMapAssets = {
      manifest: {
        version: 2,
        profile: {
          version: 2,
          projection: 'orthographic',
          cameraPitch: 60,
          cameraYaw: 30,
          orthoScale: 12,
          cellWorldSize: 128,
          pixelsPerWorldUnit: 2,
          sunAzimuth: 135,
          sunElevation: 35,
          atlasPageSize: 2048,
          padding: 4,
          extrude: 2,
          mipmaps: false
        },
        pages: [{ id: 'p0', index: 0, albedo: 'a.png', normal: 'n.png', data: 'd.png', width: 2048, height: 2048 }],
        assets: { [frame.id]: frame }
      },
      albedoPages: [dummyTexture],
      normalPages: [],
      dataPages: [],
      lightingAvailable: false,
      assets: new Map([[frame.id, mockAsset]])
    }

    const sprite = createTerrainRenderable({
      asset: mockAsset,
      assets: mockAssets,
      lightingMode: 'baked',
      alpha: 0.8,
      scaleMultiplier: 1.1
    })

    expect(sprite).toBeInstanceOf(Sprite)
    expect(sprite.alpha).toBe(0.8)
    // Scale: 1 / PPU (0.5) * 1.1 = 0.55
    expect(sprite.scale.x).toBeCloseTo(0.55)
    expect(sprite.scale.y).toBeCloseTo(0.55)
  })

  it('instantiates TerrainLightingContext with shared uniform group and light vector', () => {
    const profile = {
      version: 2 as const,
      projection: 'orthographic' as const,
      cameraPitch: 60,
      cameraYaw: 30,
      orthoScale: 12,
      cellWorldSize: 128,
      pixelsPerWorldUnit: 2,
      sunAzimuth: 135,
      sunElevation: 35,
      atlasPageSize: 2048,
      padding: 4,
      extrude: 2,
      mipmaps: false
    }

    const ctx = new TerrainLightingContext(profile)
    expect(ctx.lightDirection.x).toBeGreaterThan(0)
    expect(ctx.uniformGroup).toBeDefined()
  })
})
