import { RENDER_LIMITS } from './building.config'

/**
 * Converts grid coordinates (x, y) to screen coordinates (px) for isometric diamond grid.
 * @param x - Grid X coordinate
 * @param y - Grid Y coordinate
 * @returns Screen coordinates { x: number, y: number }
 */
export function gridToScreen(x: number, y: number): { x: number; y: number } {
  const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y) * (TILE_HEIGHT / 2)
  }
}

/**
 * Converts screen coordinates (px) back to grid coordinates (x, y).
 * Useful for building placement and interaction.
 * @param screenX - Screen X in pixels
 * @param screenY - Screen Y in pixels
 * @returns Grid coordinates { x: number, y: number }
 */
export function screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
  const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
  const x = (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2
  const y = (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2
  return {
    x: Math.round(x),
    y: Math.round(y)
  }
}

/**
 * Calculates Z-index for isometric depth sorting.
 * Higher values are "closer" to the camera.
 * @param x - Grid X
 * @param y - Grid Y
 * @returns Z-index value
 */
export function calculateZIndex(x: number, y: number): number {
  return y * 1000 + x
}
