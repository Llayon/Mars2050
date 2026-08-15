import type { GridCoord, GridSize } from './map.types'

export type { GridCoord, GridSize }

/**
 * Converts a logical grid coordinate to world coordinates (cell center).
 * @param coord Logical grid coordinate { x, y }
 * @param cellWorldSize Size of one cell in world units
 * @returns Center point of the cell in world coordinates
 */
export function cellToWorld(
  coord: GridCoord,
  cellWorldSize: number
): { x: number; y: number } {
  return {
    x: (coord.x + 0.5) * cellWorldSize,
    y: (coord.y + 0.5) * cellWorldSize
  }
}

/**
 * Converts continuous world coordinates to a logical grid coordinate.
 * @param worldX World X position
 * @param worldY World Y position
 * @param cellWorldSize Size of one cell in world units
 * @returns Logical GridCoord
 */
export function worldToCell(
  worldX: number,
  worldY: number,
  cellWorldSize: number
): GridCoord {
  return {
    x: Math.floor(worldX / cellWorldSize),
    y: Math.floor(worldY / cellWorldSize)
  }
}

/**
 * Checks whether a grid coordinate is within map boundaries.
 * @param coord Logical grid coordinate
 * @param size Grid dimensions
 * @returns True if the coordinate is strictly inside bounds
 */
export function isCellInBounds(
  coord: GridCoord,
  size: GridSize
): boolean {
  return coord.x >= 0 && coord.x < size.width && coord.y >= 0 && coord.y < size.height
}

/**
 * Returns 4-directional cardinal neighbors of a grid coordinate.
 * @param coord Logical grid coordinate
 * @returns Array of 4 neighboring GridCoords
 */
export function getCellNeighbors4(coord: GridCoord): GridCoord[] {
  return [
    { x: coord.x + 1, y: coord.y },
    { x: coord.x - 1, y: coord.y },
    { x: coord.x, y: coord.y + 1 },
    { x: coord.x, y: coord.y - 1 }
  ]
}
