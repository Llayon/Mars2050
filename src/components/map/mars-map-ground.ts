import { Container, Graphics } from 'pixi.js'
import type { WorldBounds } from './mars-map-projection'
import type { TerrainVisualField } from './mars-terrain.types'
import { TERRAIN_BIOME_CATALOG } from './mars-terrain-catalog'

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
