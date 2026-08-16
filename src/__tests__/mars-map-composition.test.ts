import { describe, it, expect } from 'vitest'
import { Container, Texture } from 'pixi.js'
import { DEFAULT_MAP_SEED } from '@/domains/map/map.config'
import type { MapLocation } from '@/domains/map/map.types'
import { generateTerrainVisualField } from '@/components/map/mars-terrain-field'
import { populateMacroTerrain, populateScatterTerrain } from '@/components/map/mars-map-terrain'
import type { LoadedMapAssets } from '@/components/map/mars-map-render.types'
import type { MapAssetManifest } from '@/components/map/mars-map-asset.types'

function createMockAssets(): LoadedMapAssets {
  const dummyTexture = Texture.WHITE
  const manifest: MapAssetManifest = {
    version: 2,
    profile: {
      version: 2,
      projection: 'orthographic',
      cameraPitch: 60,
      cameraYaw: 0,
      orthoScale: 1.0,
      cellWorldSize: 128,
      pixelsPerWorldUnit: 2,
      sunAzimuth: 135,
      sunElevation: 45,
      atlasPageSize: 2048,
      padding: 4,
      extrude: 2,
      mipmaps: false
    },
    pages: [{
      id: 'page_0',
      albedo: 'page_0.webp',
      normal: 'page_0.normal.png',
      data: 'page_0.data.png',
      width: 2048,
      height: 2048
    }],
    assets: {
      crater_medium_02: {
        id: 'crater_medium_02',
        page: 0,
        frame: { x: 0, y: 0, w: 200, h: 160 },
        anchor: { x: 0.5, y: 0.5 },
        layer: 'macro',
        footprint: [{ x: 0, y: 0 }]
      },
      crater_small_01: {
        id: 'crater_small_01',
        page: 0,
        frame: { x: 200, y: 0, w: 150, h: 130 },
        anchor: { x: 0.5, y: 0.5 },
        layer: 'macro',
        footprint: [{ x: 0, y: 0 }]
      },
      ridge_01: {
        id: 'ridge_01',
        page: 0,
        frame: { x: 350, y: 0, w: 200, h: 160 },
        anchor: { x: 0.5, y: 0.5 },
        layer: 'macro',
        footprint: [{ x: 0, y: 0 }]
      },
      ridge_02: {
        id: 'ridge_02',
        page: 0,
        frame: { x: 550, y: 0, w: 200, h: 160 },
        anchor: { x: 0.5, y: 0.5 },
        layer: 'macro',
        footprint: [{ x: 0, y: 0 }]
      },
      rocks_small_01: {
        id: 'rocks_small_01',
        page: 0,
        frame: { x: 750, y: 0, w: 80, h: 60 },
        anchor: { x: 0.5, y: 0.5 },
        layer: 'scatter',
        footprint: [{ x: 0, y: 0 }]
      },
      rocks_small_02: {
        id: 'rocks_small_02',
        page: 0,
        frame: { x: 830, y: 0, w: 80, h: 60 },
        anchor: { x: 0.5, y: 0.5 },
        layer: 'scatter',
        footprint: [{ x: 0, y: 0 }]
      },
      boulder_cluster_01: {
        id: 'boulder_cluster_01',
        page: 0,
        frame: { x: 910, y: 0, w: 80, h: 60 },
        anchor: { x: 0.5, y: 0.5 },
        layer: 'scatter',
        footprint: [{ x: 0, y: 0 }]
      }
    }
  }

  return {
    manifest,
    albedoPages: [dummyTexture],
    assets: new Map([
      ['crater_medium_02', { texture: dummyTexture, frame: manifest.assets['crater_medium_02'] }],
      ['crater_small_01', { texture: dummyTexture, frame: manifest.assets['crater_small_01'] }],
      ['ridge_01', { texture: dummyTexture, frame: manifest.assets['ridge_01'] }],
      ['ridge_02', { texture: dummyTexture, frame: manifest.assets['ridge_02'] }],
      ['rocks_small_01', { texture: dummyTexture, frame: manifest.assets['rocks_small_01'] }],
      ['rocks_small_02', { texture: dummyTexture, frame: manifest.assets['rocks_small_02'] }],
      ['boulder_cluster_01', { texture: dummyTexture, frame: manifest.assets['boulder_cluster_01'] }]
    ])
  }
}

describe('mars-map-composition (Terrain Composition & Occupancy)', () => {
  const sampleLocations: MapLocation[] = [
    {
      id: 'loc-1',
      x: 3,
      y: 3,
      type: 'crater',
      name: 'Crater A',
      difficulty: 1,
      is_discovered: true,
      resources: { minerals: 100 },
      created_at: new Date().toISOString()
    }
  ]

  it('places MapLocation POI and marks cell as occupied', () => {
    const assets = createMockAssets()
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const macroLayer = new Container()
    const occupiedCells = new Set<string>()

    populateMacroTerrain(macroLayer, sampleLocations, field, assets, 128, occupiedCells)

    expect(occupiedCells.has('3,3')).toBe(true)
    expect(macroLayer.children.length).toBeGreaterThanOrEqual(1)
  })

  it('skips occupied cells when placing scatter', () => {
    const assets = createMockAssets()
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const scatterLayer = new Container()
    const occupiedCells = new Set<string>(['3,3', '4,4', '5,5'])

    populateScatterTerrain(scatterLayer, field, assets, 128, occupiedCells)

    // Verify no scatter placed at world center of (3,3)
    const worldCenter33 = { x: 3 * 128 + 64, y: 3 * 128 + 64 }
    for (const child of scatterLayer.children) {
      const dist = Math.hypot(child.position.x - worldCenter33.x, child.position.y - worldCenter33.y)
      expect(dist).toBeGreaterThan(16)
    }
  })

  it('produces deterministic sprite placement for same seed and locations', () => {
    const assets = createMockAssets()
    const field1 = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const field2 = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })

    const macroLayer1 = new Container()
    const occupied1 = new Set<string>()
    populateMacroTerrain(macroLayer1, sampleLocations, field1, assets, 128, occupied1)

    const macroLayer2 = new Container()
    const occupied2 = new Set<string>()
    populateMacroTerrain(macroLayer2, sampleLocations, field2, assets, 128, occupied2)

    expect(macroLayer1.children.length).toBe(macroLayer2.children.length)
    expect(macroLayer1.children.map(c => ({ x: c.position.x, y: c.position.y, z: c.zIndex })))
      .toEqual(macroLayer2.children.map(c => ({ x: c.position.x, y: c.position.y, z: c.zIndex })))
  })
})
