/**
 * Calculates Chebyshev distance between two points on the grid (8-way movement).
 * @param x1 - First X coordinate
 * @param y1 - First Y coordinate
 * @param x2 - Second X coordinate
 * @param y2 - Second Y coordinate
 * @returns Chebyshev distance
 */
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2))
}
