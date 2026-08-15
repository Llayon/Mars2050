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
})
