import { Container, Graphics, Sprite } from 'pixi.js'
import type { WorldBounds } from './mars-map-projection'
import type { TerrainVisualField } from './mars-terrain.types'
import { TERRAIN_BIOME_CATALOG, selectWeightedAsset } from './mars-terrain-catalog'
import type { LoadedMapAssets } from './mars-map-render.types'
import { applyMapAssetTransform } from './mars-map-assets'
import { TERRAIN_SALTS } from './mars-terrain-biomes'
import { hashCoord } from './mars-terrain-field'

/**
 * Builds a continuous seamless Mars multi-biome ground surface.
 * Renders smooth overlapping macro-regions directly from TerrainVisualRegion descriptors,
 * completely avoiding discrete cell borders or grid tessellation lines.
 */
export function buildContinuousGround(
  parentLayer: Container,
  bounds: WorldBounds,
  field: TerrainVisualField,
  cellWorldSize: number
): void {
  const groundGraphic = new Graphics()

  // Base Martian regolith bedrock foundation
  groundGraphic
    .rect(bounds.minX, bounds.minY, bounds.width, bounds.height)
    .fill({ color: 0x22130d, alpha: 1.0 })

  // Render organic macro-region expanses from continuous descriptors
  for (const region of field.regions) {
    const rule = TERRAIN_BIOME_CATALOG[region.biome]
    if (!rule) continue

    const cx = bounds.minX + region.centerX * cellWorldSize
    const cy = bounds.minY + region.centerY * cellWorldSize

    // Base dimension spanning across the macro zone
    const baseRadiusX = region.scaleX * region.influence * cellWorldSize * 3.6
    const baseRadiusY = region.scaleY * region.influence * cellWorldSize * 3.6

    // Outer soft halo
    groundGraphic
      .ellipse(cx, cy, baseRadiusX * 1.3, baseRadiusY * 1.3)
      .fill({ color: rule.baseColor, alpha: 0.25 })

    // Inner region core
    groundGraphic
      .ellipse(cx, cy, baseRadiusX * 0.85, baseRadiusY * 0.85)
      .fill({ color: rule.baseColor, alpha: 0.40 })
  }

  // Soft atmospheric boundary border
  groundGraphic
    .rect(bounds.minX, bounds.minY, bounds.width, bounds.height)
    .stroke({ color: 0x4a2416, width: 2, alpha: 0.35 })

  parentLayer.addChild(groundGraphic)
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
  cellWorldSize: number
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

      const sprite = new Sprite(runtimeAsset.texture)
      applyMapAssetTransform(sprite, runtimeAsset.frame, assets.manifest.profile)

      // Small uniform scale variation (0.90..1.10) preserving PPU ratio
      const scaleHash = hashCoord(field.seed, region.centerX - i, region.centerY + i, TERRAIN_SALTS.GROUND_DECAL_SCALE)
      const scaleMultiplier = 0.90 + (scaleHash % 200) / 1000
      sprite.scale.x *= scaleMultiplier
      sprite.scale.y *= scaleMultiplier

      // Strictly zero rotation to preserve universal sun azimuth
      sprite.rotation = 0

      // Smooth blending into bedrock
      sprite.alpha = 0.70
      sprite.position.set(posX, posY)

      groundDecalLayer.addChild(sprite)
    }
  }
}
