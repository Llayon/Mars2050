import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  ASSET_RENDER_LAYERS,
  MapRenderProfileSchema,
  VisualAssetFrameSchema,
  MapAssetManifestSchema,
  type MapAssetManifest
} from '@/components/map/mars-map-asset.types'

describe('mars-map-asset.contract (Stage 2 Square Grid Asset Contract & Invariants)', () => {
  const baseProfile = {
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

  const basePage = {
    id: 'terrain-0',
    albedo: '/assets/map/terrain-albedo-0.webp',
    normal: '/assets/map/terrain-normal-0.png',
    data: '/assets/map/terrain-data-0.png',
    width: 2048,
    height: 2048
  }

  it('validates checked-in map-render-profile.json against Version 2 schema', () => {
    const profilePath = path.join(process.cwd(), 'assets', 'pipeline', 'map-render-profile.json')
    const raw = fs.readFileSync(profilePath, 'utf-8')
    const parsedJson = JSON.parse(raw)

    const result = MapRenderProfileSchema.safeParse(parsedJson)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.version).toBe(2)
      expect(result.data.cellWorldSize).toBe(128)
      expect(result.data.cameraPitch).toBe(60)
      expect(result.data.cameraYaw).toBe(30)
      expect(result.data.atlasPageSize).toBe(2048)
      expect(result.data.padding).toBe(4)
      expect(result.data.extrude).toBe(2)
    }
  })

  it('defines 5 visual render layers', () => {
    expect(ASSET_RENDER_LAYERS).toEqual(['ground', 'macro', 'scatter', 'infrastructure', 'entity'])
  })

  it('validates a complete VisualAssetFrame with overhang and square footprint', () => {
    const validFrame = {
      id: 'crater-medium-03',
      page: 0,
      frame: { x: 512, y: 256, w: 320, h: 240 },
      anchor: { x: 0.5, y: 0.72 },
      overhang: { top: 80, right: 50, bottom: 20, left: 50 },
      footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      layer: 'macro' as const
    }

    const result = VisualAssetFrameSchema.safeParse(validFrame)
    expect(result.success).toBe(true)
  })

  it('rejects duplicate footprint coordinates in frame schema', () => {
    const result = VisualAssetFrameSchema.safeParse({
      id: 'canyon-dup',
      page: 0,
      frame: { x: 0, y: 0, w: 100, h: 100 },
      anchor: { x: 0.5, y: 0.5 },
      footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }],
      layer: 'macro'
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative overhang coordinates', () => {
    expect(VisualAssetFrameSchema.safeParse({
      id: 'crater-neg-overhang',
      page: 0,
      frame: { x: 0, y: 0, w: 100, h: 100 },
      anchor: { x: 0.5, y: 0.5 },
      overhang: { top: -10, right: 0, bottom: 0, left: 0 },
      layer: 'macro'
    }).success).toBe(false)
  })

  it('rejects manifest with out-of-bounds page reference or frame dimensions', () => {
    const badPageManifest: MapAssetManifest = {
      version: 2,
      profile: baseProfile,
      pages: [basePage],
      assets: {
        'crater-out': {
          id: 'crater-out',
          page: 1, // Only page 0 exists
          frame: { x: 0, y: 0, w: 100, h: 100 },
          anchor: { x: 0.5, y: 0.5 },
          layer: 'macro'
        }
      }
    }
    expect(MapAssetManifestSchema.safeParse(badPageManifest).success).toBe(false)

    const overflowFrameManifest: MapAssetManifest = {
      version: 2,
      profile: baseProfile,
      pages: [basePage],
      assets: {
        'crater-overflow': {
          id: 'crater-overflow',
          page: 0,
          frame: { x: 2000, y: 0, w: 100, h: 100 }, // 2000 + 100 > 2048
          anchor: { x: 0.5, y: 0.5 },
          layer: 'macro'
        }
      }
    }
    expect(MapAssetManifestSchema.safeParse(overflowFrameManifest).success).toBe(false)
  })

  it('rejects manifest with duplicate page IDs or mismatched map key', () => {
    const dupPageManifest: MapAssetManifest = {
      version: 2,
      profile: baseProfile,
      pages: [basePage, { ...basePage }], // Duplicate id 'terrain-0'
      assets: {}
    }
    expect(MapAssetManifestSchema.safeParse(dupPageManifest).success).toBe(false)

    const keyMismatchManifest: MapAssetManifest = {
      version: 2,
      profile: baseProfile,
      pages: [basePage],
      assets: {
        'wrong-key': {
          id: 'crater-01',
          page: 0,
          frame: { x: 0, y: 0, w: 100, h: 100 },
          anchor: { x: 0.5, y: 0.5 },
          layer: 'macro'
        }
      }
    }
    expect(MapAssetManifestSchema.safeParse(keyMismatchManifest).success).toBe(false)
  })

  it('validates a complete multi-page MapAssetManifest with Version 2', () => {
    const manifest: MapAssetManifest = {
      version: 2,
      profile: baseProfile,
      pages: [
        basePage,
        {
          id: 'terrain-1',
          albedo: '/assets/map/terrain-albedo-1.webp',
          normal: '/assets/map/terrain-normal-1.png',
          data: '/assets/map/terrain-data-1.png',
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
        },
        'dune-large-01': {
          id: 'dune-large-01',
          page: 1,
          frame: { x: 0, y: 0, w: 512, h: 256 },
          anchor: { x: 0.5, y: 0.75 },
          layer: 'ground'
        }
      }
    }

    const result = MapAssetManifestSchema.safeParse(manifest)
    expect(result.success).toBe(true)
  })
})
