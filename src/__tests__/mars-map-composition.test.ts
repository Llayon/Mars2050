import { describe, it, expect } from 'vitest'
import { Container, Texture, type Sprite } from 'pixi.js'
import { DEFAULT_MAP_SEED } from '@/domains/map/map.config'
import type { MapLocation } from '@/domains/map/map.types'
import { generateTerrainVisualField } from '@/components/map/mars-terrain-field'
import { populateTerrainLayers, type TerrainLayerHierarchy } from '@/components/map/mars-map-terrain'
import type { LoadedMapAssets } from '@/components/map/mars-map-render.types'
import type { MapAssetManifest, VisualAssetFrame } from '@/components/map/mars-map-asset.types'

const MOCK_ASSET_IDS = [
  { id: 'regolith_patch_01', layer: 'ground' },
  { id: 'regolith_patch_02', layer: 'ground' },
  { id: 'basalt_patch_01', layer: 'ground' },
  { id: 'dust_patch_01', layer: 'ground' },
  { id: 'crater_medium_02', layer: 'macro' },
  { id: 'crater_small_01', layer: 'macro' },
  { id: 'crater_large_01', layer: 'macro' },
  { id: 'mesa_medium_01', layer: 'macro' },
  { id: 'ridge_chain_01', layer: 'macro' },
  { id: 'ridge_01', layer: 'macro' },
  { id: 'ridge_02', layer: 'macro' },
  { id: 'dust_drift_01', layer: 'ground' },
  { id: 'erosion_strip_01', layer: 'ground' },
  { id: 'rock_field_01', layer: 'ground' },
  { id: 'cracked_ground_01', layer: 'ground' },
  { id: 'rocks_small_01', layer: 'scatter' },
  { id: 'rocks_small_02', layer: 'scatter' },
  { id: 'boulder_cluster_01', layer: 'scatter' },
  { id: 'boulder_cluster_02', layer: 'scatter' }
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

function createMockLayers(): TerrainLayerHierarchy {
  return {
    surfaceDetailLayer: new Container(),
    formationGroundLayer: new Container(),
    macroLayer: new Container(),
    heroLayer: new Container(),
    scatterLayer: new Container(),
    microLayer: new Container()
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
    const layers = createMockLayers()
    const occupiedCells = new Set<string>()

    populateTerrainLayers(layers, sampleLocations, field, assets, 128, occupiedCells)

    expect(occupiedCells.has('3,3')).toBe(true)
    expect(layers.macroLayer.children.length).toBeGreaterThanOrEqual(1)
  })

  it('populates geological clusters and meso formations into appropriate layers', () => {
    const assets = createMockAssets()
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const layers = createMockLayers()
    const occupiedCells = new Set<string>()

    populateTerrainLayers(layers, sampleLocations, field, assets, 128, occupiedCells)

    const totalVisible =
      layers.surfaceDetailLayer.children.length +
      layers.formationGroundLayer.children.length +
      layers.macroLayer.children.length +
      layers.heroLayer.children.length +
      layers.scatterLayer.children.length +
      layers.microLayer.children.length

    expect(totalVisible).toBeGreaterThan(10)
    expect(totalVisible).toBeLessThan(120) // Within TMA budget
  })

  it('produces deterministic formation placement for identical seeds', () => {
    const assets = createMockAssets()
    const field1 = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const field2 = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })

    const layers1 = createMockLayers()
    const occupied1 = new Set<string>()
    populateTerrainLayers(layers1, sampleLocations, field1, assets, 128, occupied1)

    const layers2 = createMockLayers()
    const occupied2 = new Set<string>()
    populateTerrainLayers(layers2, sampleLocations, field2, assets, 128, occupied2)

    expect(layers1.heroLayer.children.length).toBe(layers2.heroLayer.children.length)
    expect(layers1.macroLayer.children.length).toBe(layers2.macroLayer.children.length)
    expect(layers1.scatterLayer.children.length).toBe(layers2.scatterLayer.children.length)

    expect(layers1.macroLayer.children.map(c => ({ x: c.position.x, y: c.position.y, z: c.zIndex })))
      .toEqual(layers2.macroLayer.children.map(c => ({ x: c.position.x, y: c.position.y, z: c.zIndex })))
  })

  it('preserves exact spatial positions, scales, and zIndices when switching baked vs enhanced lighting', async () => {
    const assets = createMockAssets()
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const { TerrainLightingContext } = await import('@/components/map/mars-map-lit-mesh')
    const lightingContext = new TerrainLightingContext(assets.manifest.profile)

    // Baked mode
    const layersBaked = createMockLayers()
    const occupiedBaked = new Set<string>()
    populateTerrainLayers(layersBaked, sampleLocations, field, assets, 128, occupiedBaked, null, 'baked')

    // Enhanced mode
    const layersEnhanced = createMockLayers()
    const occupiedEnhanced = new Set<string>()
    populateTerrainLayers(layersEnhanced, sampleLocations, field, assets, 128, occupiedEnhanced, lightingContext, 'enhanced')

    expect(layersBaked.macroLayer.children.length).toBe(layersEnhanced.macroLayer.children.length)
    expect(layersBaked.heroLayer.children.length).toBe(layersEnhanced.heroLayer.children.length)

    for (let i = 0; i < layersBaked.macroLayer.children.length; i++) {
      const b = layersBaked.macroLayer.children[i]
      const e = layersEnhanced.macroLayer.children[i]

      expect(e.position.x).toBe(b.position.x)
      expect(e.position.y).toBe(b.position.y)
      expect(e.scale.x).toBe(b.scale.x)
      expect(e.scale.y).toBe(b.scale.y)
      expect(e.rotation).toBe(b.rotation)
      expect(e.zIndex).toBe(b.zIndex)
    }
  })
})
