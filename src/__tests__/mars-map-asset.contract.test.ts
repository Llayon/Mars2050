import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  HEX_SOCKET_DIRECTIONS,
  ASSET_RENDER_LAYERS,
  MapRenderProfileSchema,
  VisualAssetFrameSchema,
  MapAssetManifestSchema,
  type MapAssetManifest
} from '@/components/map/mars-map-asset.types'

describe('mars-map-asset.contract (Stage 1 Asset Contract)', () => {
  it('validates checked-in map-render-profile.json against schema', () => {
    const profilePath = path.join(process.cwd(), 'assets', 'pipeline', 'map-render-profile.json')
    const raw = fs.readFileSync(profilePath, 'utf-8')
    const parsedJson = JSON.parse(raw)

    const result = MapRenderProfileSchema.safeParse(parsedJson)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hexOrientation).toBe('pointy')
      expect(result.data.cameraPitch).toBe(60)
      expect(result.data.cameraYaw).toBe(30)
      expect(result.data.atlasPageSize).toBe(2048)
      expect(result.data.padding).toBe(4)
      expect(result.data.extrude).toBe(2)
    }
  })

  it('maintains canonical 6 socket directions in E -> NE -> NW -> W -> SW -> SE order', () => {
    expect(HEX_SOCKET_DIRECTIONS).toEqual(['E', 'NE', 'NW', 'W', 'SW', 'SE'])
    expect(HEX_SOCKET_DIRECTIONS.length).toBe(6)
  })

  it('defines 5 visual render layers', () => {
    expect(ASSET_RENDER_LAYERS).toEqual(['ground', 'macro', 'scatter', 'infrastructure', 'entity'])
  })

  it('validates a complete VisualAssetFrame with overhang, footprint, and 6 sockets', () => {
    const validFrame = {
      id: 'crater-medium-03',
      page: 0,
      frame: { x: 512, y: 256, w: 320, h: 240 },
      anchor: { x: 0.5, y: 0.72 },
      overhang: { top: 80, right: 50, bottom: 20, left: 50 },
      footprint: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      sockets: ['cliff', 'ground', 'ground', 'cliff', 'ground', 'ground'] as [string, string, string, string, string, string],
      layer: 'macro' as const
    }

    const result = VisualAssetFrameSchema.safeParse(validFrame)
    expect(result.success).toBe(true)
  })

  it('rejects VisualAssetFrame with invalid socket count', () => {
    const invalidFrame = {
      id: 'crater-invalid',
      page: 0,
      frame: { x: 0, y: 0, w: 100, h: 100 },
      anchor: { x: 0.5, y: 0.5 },
      sockets: ['ground', 'ground', 'ground'], // Only 3 instead of 6
      layer: 'macro'
    }

    const result = VisualAssetFrameSchema.safeParse(invalidFrame)
    expect(result.success).toBe(false)
  })

  it('rejects VisualAssetFrame with invalid anchor or dimensions', () => {
    expect(VisualAssetFrameSchema.safeParse({
      id: 'bad-anchor',
      page: 0,
      frame: { x: 0, y: 0, w: 100, h: 100 },
      anchor: { x: 1.5, y: 0.5 }, // > 1
      layer: 'ground'
    }).success).toBe(false)

    expect(VisualAssetFrameSchema.safeParse({
      id: 'bad-dim',
      page: 0,
      frame: { x: 0, y: 0, w: 0, h: 100 }, // w <= 0
      anchor: { x: 0.5, y: 0.5 },
      layer: 'ground'
    }).success).toBe(false)
  })

  it('validates a complete multi-page MapAssetManifest', () => {
    const manifest: MapAssetManifest = {
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
        atlasPageSize: 2048,
        padding: 4,
        extrude: 2
      },
      pages: [
        {
          id: 'terrain-0',
          albedo: '/assets/map/terrain-albedo-0.webp',
          normal: '/assets/map/terrain-normal-0.png',
          data: '/assets/map/terrain-data-0.png',
          width: 2048,
          height: 2048
        }
      ],
      assets: {
        'crater-medium-01': {
          id: 'crater-medium-01',
          page: 0,
          frame: { x: 0, y: 0, w: 256, h: 256 },
          anchor: { x: 0.5, y: 0.5 },
          layer: 'macro'
        }
      }
    }

    const result = MapAssetManifestSchema.safeParse(manifest)
    expect(result.success).toBe(true)
  })
})
