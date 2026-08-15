import { Container, Graphics } from 'pixi.js'
import type { WorldBounds } from './mars-map-projection'

/**
 * Builds a continuous seamless Mars regolith ground surface.
 * Does not render individual tile cells or cell borders.
 */
export function buildContinuousGround(
  parentLayer: Container,
  bounds: WorldBounds
): void {
  const groundGraphic = new Graphics()

  // Base Mars surface plane
  groundGraphic
    .rect(bounds.minX, bounds.minY, bounds.width, bounds.height)
    .fill({ color: 0x1f120c, alpha: 1.0 })

  // Subtle natural terrain color variation patches across the map
  const patchCols = 8
  const patchRows = 8
  const patchW = bounds.width / patchCols
  const patchH = bounds.height / patchRows

  for (let r = 0; r < patchRows; r++) {
    for (let c = 0; c < patchCols; c++) {
      const hash = ((c * 374761393) ^ (r * 668265263)) >>> 0
      const isAlt = hash % 3 === 0
      const isDark = hash % 5 === 0

      if (isAlt || isDark) {
        const px = bounds.minX + c * patchW
        const py = bounds.minY + r * patchH
        const color = isDark ? 0x180d08 : 0x27160f

        groundGraphic
          .ellipse(px + patchW / 2, py + patchH / 2, patchW * 0.6, patchH * 0.6)
          .fill({ color, alpha: 0.45 })
      }
    }
  }

  // Soft boundary border
  groundGraphic
    .rect(bounds.minX, bounds.minY, bounds.width, bounds.height)
    .stroke({ color: 0x3d2014, width: 2, alpha: 0.3 })

  parentLayer.addChild(groundGraphic)
}
