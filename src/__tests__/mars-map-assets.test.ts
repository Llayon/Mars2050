import { describe, it, expect } from 'vitest'
import { Sprite, Texture } from 'pixi.js'
import { applyMapAssetTransform, terrainSortKey } from '@/components/map/mars-map-assets'
import type { MapRenderProfile, VisualAssetFrame } from '@/components/map/mars-map-asset.types'

describe('mars-map-assets (Transform & Sorting)', () => {
  const profile: MapRenderProfile = {
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
  }

  it('applies normalized anchor and 1/pixelsPerWorldUnit scale to sprite', () => {
    const frame: VisualAssetFrame = {
      id: 'crater-medium-01',
      page: 0,
      frame: { x: 0, y: 0, w: 200, h: 160 },
      anchor: { x: 0.5, y: 0.75 },
      layer: 'macro'
    }

    const sprite = new Sprite(Texture.EMPTY)
    applyMapAssetTransform(sprite, frame, profile)

    expect(sprite.anchor.x).toBe(0.5)
    expect(sprite.anchor.y).toBe(0.75)
    // 1 / pixelsPerWorldUnit = 1 / 2 = 0.5
    expect(sprite.scale.x).toBe(0.5)
    expect(sprite.scale.y).toBe(0.5)
  })

  it('calculates deterministic integer terrain sort keys', () => {
    expect(terrainSortKey(128.456, 10)).toBe(12846 + 10)
    expect(terrainSortKey(0, 5)).toBe(5)
    expect(terrainSortKey(500.123)).toBe(50012)
  })

  it('applies transform to non-sprite display objects without anchor', () => {
    const frame: VisualAssetFrame = {
      id: 'rock-01',
      page: 0,
      frame: { x: 0, y: 0, w: 50, h: 50 },
      anchor: { x: 0.5, y: 0.5 },
      layer: 'scatter'
    }

    const mockMesh = {
      scale: {
        x: 1,
        y: 1,
        set(s: number) {
          this.x = s
          this.y = s
        }
      }
    }

    applyMapAssetTransform(mockMesh, frame, profile)
    expect(mockMesh.scale.x).toBe(0.5)
    expect(mockMesh.scale.y).toBe(0.5)
  })
})

describe('mars-map-assets (loadMapAssets)', () => {
  it('loads multi-channel pages and builds matching subtextures', async () => {
    const dummyManifest = {
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
      pages: [
        {
          id: 'page_0',
          index: 0,
          albedo: '/assets/map/atlas_0.albedo.png',
          normal: '/assets/map/atlas_0.normal.png',
          data: '/assets/map/atlas_0.data.png',
          width: 2048,
          height: 2048
        }
      ],
      assets: {
        'crater-01': {
          id: 'crater-01',
          page: 0,
          frame: { x: 10, y: 20, w: 100, h: 80 },
          anchor: { x: 0.5, y: 0.5 },
          layer: 'macro'
        }
      }
    }

    const { Assets } = await import('pixi.js')
    const originalFetch = globalThis.fetch
    const originalAssetsLoad = Assets.load

    const mockTexture = Texture.EMPTY

    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => dummyManifest
      }) as unknown as Response

    Assets.load = (async () => mockTexture) as typeof Assets.load

    try {
      const { loadMapAssets } = await import('@/components/map/mars-map-assets')
      const loaded = await loadMapAssets('/test-manifest.json')

      expect(loaded.lightingAvailable).toBe(true)
      expect(loaded.albedoPages.length).toBe(1)
      expect(loaded.normalPages.length).toBe(1)
      expect(loaded.dataPages.length).toBe(1)

      const crater = loaded.assets.get('crater-01')
      expect(crater).toBeDefined()
      expect(crater?.texture.frame.x).toBe(10)
      expect(crater?.texture.frame.y).toBe(20)
      expect(crater?.texture.frame.width).toBe(100)
      expect(crater?.texture.frame.height).toBe(80)

      expect(crater?.normalTexture).toBeDefined()
      expect(crater?.normalTexture?.frame.x).toBe(10)
      expect(crater?.normalTexture?.frame.y).toBe(20)

      expect(crater?.dataTexture).toBeDefined()
      expect(crater?.dataTexture?.frame.x).toBe(10)
      expect(crater?.dataTexture?.frame.y).toBe(20)
    } finally {
      globalThis.fetch = originalFetch
      Assets.load = originalAssetsLoad
    }
  })

  it('gracefully falls back to baked mode if companion channels fail to load', async () => {
    const dummyManifest = {
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
      pages: [
        {
          id: 'page_0',
          index: 0,
          albedo: '/assets/map/atlas_0.albedo.png',
          normal: '/assets/map/atlas_0.normal.png',
          data: '/assets/map/atlas_0.data.png',
          width: 2048,
          height: 2048
        }
      ],
      assets: {
        'rock-01': {
          id: 'rock-01',
          page: 0,
          frame: { x: 5, y: 5, w: 40, h: 40 },
          anchor: { x: 0.5, y: 0.5 },
          layer: 'scatter'
        }
      }
    }

    const { Assets } = await import('pixi.js')
    const originalFetch = globalThis.fetch
    const originalAssetsLoad = Assets.load

    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => dummyManifest
      }) as unknown as Response

    Assets.load = (async (url: string) => {
      if (url.includes('.normal.') || url.includes('.data.')) {
        throw new Error('404 Not Found')
      }
      return Texture.EMPTY
    }) as typeof Assets.load

    try {
      const { loadMapAssets } = await import('@/components/map/mars-map-assets')
      const loaded = await loadMapAssets('/test-manifest.json')

      expect(loaded.lightingAvailable).toBe(false)
      expect(loaded.albedoPages.length).toBe(1)
      const rock = loaded.assets.get('rock-01')
      expect(rock).toBeDefined()
      expect(rock?.texture).toBeDefined()
      expect(rock?.normalTexture).toBeUndefined()
      expect(rock?.dataTexture).toBeUndefined()
    } finally {
      globalThis.fetch = originalFetch
      Assets.load = originalAssetsLoad
    }
  })
})
