import { Container, Mesh, MeshGeometry } from 'pixi.js'
import type { WorldBounds } from './mars-map-projection'
import type { TerrainBiome, TerrainVisualField } from './mars-terrain.types'
import { TERRAIN_BIOME_CATALOG, selectWeightedAsset } from './mars-terrain-catalog'
import type { LoadedMapAssets } from './mars-map-render.types'
import { TERRAIN_SALTS } from './mars-terrain-biomes'
import { hashCoord } from './mars-terrain-field'
import { createTerrainRenderable, type TerrainLightingContext } from './mars-map-lit-mesh'
import type { TerrainLightingMode } from './mars-map-lighting'
import { createMarsGroundShader } from './mars-ground.shader'

/**
 * Biome enum to numeric code for ground shader.
 */
function getBiomeCode(biome: TerrainBiome): number {
  switch (biome) {
    case 'regolith': return 0
    case 'dust_basin': return 1
    case 'dunes': return 2
    case 'basalt': return 3
    case 'highlands': return 4
    case 'canyon': return 5
    default: return 0
  }
}

/**
 * Builds a continuous seamless Mars multi-biome ground surface.
 * Renders a single quad Mesh with procedural noise and organic biome modulation,
 * eliminating all visible geometric borders and ellipses.
 */
export function buildContinuousGround(
  parentLayer: Container,
  bounds: WorldBounds,
  field: TerrainVisualField,
  cellWorldSize: number
): void {
  const geometry = new MeshGeometry({
    positions: new Float32Array([
      bounds.minX, bounds.minY,
      bounds.maxX, bounds.minY,
      bounds.maxX, bounds.maxY,
      bounds.minX, bounds.maxY
    ]),
    uvs: new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3])
  })

  // Populate uniform array with continuous macro-region descriptors
  const regionArray = new Float32Array(32)
  const regionCount = Math.min(8, field.regions.length)

  for (let i = 0; i < regionCount; i++) {
    const reg = field.regions[i]
    const cx = bounds.minX + reg.centerX * cellWorldSize
    const cy = bounds.minY + reg.centerY * cellWorldSize
    const radius = reg.scaleX * reg.influence * cellWorldSize * 3.0
    const biomeCode = getBiomeCode(reg.biome)

    regionArray[i * 4 + 0] = cx
    regionArray[i * 4 + 1] = cy
    regionArray[i * 4 + 2] = radius
    regionArray[i * 4 + 3] = biomeCode
  }

  const shader = createMarsGroundShader(field.seed, regionArray, regionCount)
  const groundMesh = new Mesh({ geometry, shader })
  parentLayer.addChild(groundMesh)
}

/**
 * Populates organic biome ground decals attached to continuous macro-regions.
 * Uses 2-5 continuous elliptical samples per region, preserving authored PPU scale
 * with zero rotation to maintain universal baked Martian sunlight direction.
 */
export function populateGroundDecals(
  groundDecalLayer: Container,
  bounds: WorldBounds,
  field: TerrainVisualField,
  assets: LoadedMapAssets,
  cellWorldSize: number,
  lightingContext?: TerrainLightingContext | null,
  lightingMode?: TerrainLightingMode
): void {
  for (const region of field.regions) {
    const rule = TERRAIN_BIOME_CATALOG[region.biome]
    if (!rule || rule.groundDecals.length === 0) continue

    // 2-5 decals per macro region depending on influence
    const count = Math.min(5, Math.max(2, Math.round(region.influence * 3)))

    const cx = bounds.minX + region.centerX * cellWorldSize
    const cy = bounds.minY + region.centerY * cellWorldSize
    const baseRadiusX = region.scaleX * region.influence * cellWorldSize * 2.8
    const baseRadiusY = region.scaleY * region.influence * cellWorldSize * 2.8

    for (let i = 0; i < count; i++) {
      const posHashX = hashCoord(field.seed, region.centerX + i * 7, region.centerY, TERRAIN_SALTS.GROUND_DECAL_POSITION)
      const posHashY = hashCoord(field.seed, region.centerX, region.centerY + i * 11, TERRAIN_SALTS.GROUND_DECAL_POSITION)

      // Continuous normalized offsets in [-0.75, 0.75] within region ellipse
      const normX = (((posHashX % 2000) - 1000) / 1000) * 0.75
      const normY = (((posHashY % 2000) - 1000) / 1000) * 0.75

      const rawX = cx + normX * baseRadiusX
      const rawY = cy + normY * baseRadiusY

      // Clamp within world bounds with padding
      const posX = Math.max(bounds.minX + 32, Math.min(bounds.maxX - 32, rawX))
      const posY = Math.max(bounds.minY + 32, Math.min(bounds.maxY - 32, rawY))

      // Select variant deterministically
      const varHash = hashCoord(field.seed, region.centerX + i, region.centerY + i, TERRAIN_SALTS.GROUND_DECAL_VARIANT)
      const assetId = selectWeightedAsset(rule.groundDecals, varHash)
      if (!assetId) continue

      const runtimeAsset = assets.assets.get(assetId)
      if (!runtimeAsset) continue

      // Small uniform scale variation (0.90..1.10) preserving PPU ratio
      const scaleHash = hashCoord(field.seed, region.centerX - i, region.centerY + i, TERRAIN_SALTS.GROUND_DECAL_SCALE)
      const scaleMultiplier = 0.90 + (scaleHash % 200) / 1000

      const renderable = createTerrainRenderable({
        asset: runtimeAsset,
        assets,
        lightingContext,
        lightingMode,
        alpha: 0.70,
        scaleMultiplier
      })

      // Strictly zero rotation to preserve universal sun azimuth
      renderable.rotation = 0
      renderable.position.set(posX, posY)

      groundDecalLayer.addChild(renderable)
    }
  }
}
