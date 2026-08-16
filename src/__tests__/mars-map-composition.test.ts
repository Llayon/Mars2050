import { describe, it, expect } from 'vitest'
import { Container, Texture, type Sprite } from 'pixi.js'
import { DEFAULT_MAP_SEED } from '@/domains/map/map.config'
import type { MapLocation } from '@/domains/map/map.types'
import { generateTerrainVisualField } from '@/components/map/mars-terrain-field'
import { populateMacroTerrain, populateScatterTerrain } from '@/components/map/mars-map-terrain'
import { populateGroundDecals } from '@/components/map/mars-map-ground'
import { calculateGridWorldBounds } from '@/components/map/mars-map-projection'
import type { LoadedMapAssets } from '@/components/map/mars-map-render.types'
import type { MapAssetManifest, VisualAssetFrame } from '@/components/map/mars-map-asset.types'

const MOCK_ASSET_IDS = [
  { id: 'regolith_patch_01', layer: 'ground' },
  { id: 'regolith_patch_02', layer: 'ground' },
  { id: 'basalt_patch_01', layer: 'ground' },
  { id: 'dust_patch_01', layer: 'ground' },
  { id: 'crater_medium_02', layer: 'macro' },
  { id: 'crater_small_01', layer: 'macro' },
  { id: 'ridge_01', layer: 'macro' },
  { id: 'ridge_02', layer: 'macro' },
  { id: 'rocks_small_01', layer: 'scatter' },
  { id: 'rocks_small_02', layer: 'scatter' },
  { id: 'boulder_cluster_01', layer: 'scatter' }
] as const

function createMockAssets(): LoadedMapAssets {
  const dummyTexture = Texture.WHITE
  const assetsDict: Record<string, VisualAssetFrame> = {}
  const runtimeMap = new Map<string, { texture: Texture; frame: VisualAssetFrame }>()

  for (const def of MOCK_ASSET_IDS) {
    const frame: VisualAssetFrame = {
      id: def.id,
      page: 0,
      frame: { x: 0, y: 0, w: 100, h: 80 },
      anchor: { x: 0.5, y: 0.5 },
      layer: def.layer,
      footprint: [{ x: 0, y: 0 }]
    }
    assetsDict[def.id] = frame
    runtimeMap.set(def.id, { texture: dummyTexture, frame })
  }

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
    assets: assetsDict
  }

  return {
    manifest,
    albedoPages: [dummyTexture],
    normalPages: [dummyTexture],
    dataPages: [dummyTexture],
    lightingAvailable: true,
    assets: runtimeMap
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

  it('populates continuous ground decals with zero rotation and bounded count', () => {
    const assets = createMockAssets()
    const worldBounds = calculateGridWorldBounds(20, 20, 128)
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const decalLayer = new Container()

    populateGroundDecals(decalLayer, worldBounds, field, assets, 128)

    // Verify 15-30 ground decals populated across default 7 macro regions
    expect(decalLayer.children.length).toBeGreaterThanOrEqual(15)
    expect(decalLayer.children.length).toBeLessThanOrEqual(35)

    for (const child of decalLayer.children) {
      const sprite = child as Sprite
      expect(sprite.rotation).toBe(0)
      expect(sprite.position.x).toBeGreaterThanOrEqual(worldBounds.minX)
      expect(sprite.position.x).toBeLessThanOrEqual(worldBounds.maxX)
      expect(sprite.position.y).toBeGreaterThanOrEqual(worldBounds.minY)
      expect(sprite.position.y).toBeLessThanOrEqual(worldBounds.maxY)
      expect(sprite.scale.x).toBeGreaterThan(0.4)
      expect(sprite.scale.x).toBeLessThan(0.6)
    }
  })

  it('produces deterministic ground decal placement for identical seeds', () => {
    const assets = createMockAssets()
    const worldBounds = calculateGridWorldBounds(20, 20, 128)
    const field1 = generateTerrainVisualField({ width: 20, height: 20, seed: 12345 })
    const field2 = generateTerrainVisualField({ width: 20, height: 20, seed: 12345 })
    const fieldDiff = generateTerrainVisualField({ width: 20, height: 20, seed: 99999 })

    const layer1 = new Container()
    const layer2 = new Container()
    const layerDiff = new Container()

    populateGroundDecals(layer1, worldBounds, field1, assets, 128)
    populateGroundDecals(layer2, worldBounds, field2, assets, 128)
    populateGroundDecals(layerDiff, worldBounds, fieldDiff, assets, 128)

    expect(layer1.children.length).toBe(layer2.children.length)
    expect(layer1.children.map(c => ({ x: c.position.x, y: c.position.y })))
      .toEqual(layer2.children.map(c => ({ x: c.position.x, y: c.position.y })))

    expect(layer1.children.map(c => ({ x: c.position.x, y: c.position.y })))
      .not.toEqual(layerDiff.children.map(c => ({ x: c.position.x, y: c.position.y })))
  })

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

  it('preserves exact spatial positions, scales, and zIndices when switching baked vs enhanced lighting', async () => {
    const assets = createMockAssets()
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const { TerrainLightingContext } = await import('@/components/map/mars-map-lit-mesh')
    const lightingContext = new TerrainLightingContext(assets.manifest.profile)

    // Baked mode
    const macroBaked = new Container()
    const occupiedBaked = new Set<string>()
    populateMacroTerrain(macroBaked, sampleLocations, field, assets, 128, occupiedBaked, null, 'baked')

    // Enhanced mode
    const macroEnhanced = new Container()
    const occupiedEnhanced = new Set<string>()
    populateMacroTerrain(macroEnhanced, sampleLocations, field, assets, 128, occupiedEnhanced, lightingContext, 'enhanced')

    expect(macroBaked.children.length).toBe(macroEnhanced.children.length)

    for (let i = 0; i < macroBaked.children.length; i++) {
      const b = macroBaked.children[i]
      const e = macroEnhanced.children[i]

      expect(e.position.x).toBe(b.position.x)
      expect(e.position.y).toBe(b.position.y)
      expect(e.scale.x).toBe(b.scale.x)
      expect(e.scale.y).toBe(b.scale.y)
      expect(e.rotation).toBe(b.rotation)
      expect(e.zIndex).toBe(b.zIndex)
    }
  })
})
