import type { HexCoord, MapLocation } from './map.types'

/**
 * Canonical 6 axial directions for pointy-top hexagons:
 * Order: E -> NE -> NW -> W -> SW -> SE
 */
export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },   // E
  { q: 1, r: -1 },  // NE
  { q: 0, r: -1 },  // NW
  { q: -1, r: 0 },  // W
  { q: -1, r: 1 },  // SW
  { q: 0, r: 1 }    // SE
] as const

/**
 * Converts axial hex coordinates (q, r) to 2D world coordinates (pointy-top orientation).
 * @param coord - Axial hex coordinate
 * @param radius - Outer radius of the hexagon (distance from center to corner)
 * @returns 2D Cartesian world position { x, y }
 */
export function hexToWorld(coord: HexCoord, radius: number): { x: number; y: number } {
  if (radius <= 0) {
    throw new RangeError('Hex radius must be positive')
  }
  const x = radius * Math.sqrt(3) * (coord.q + coord.r / 2)
  const y = radius * 1.5 * coord.r
  return { x, y }
}

/**
 * Converts 2D world coordinates to closest axial hex coordinate using cube rounding.
 * @param x - World X position
 * @param y - World Y position
 * @param radius - Outer radius of the hexagon
 * @returns Rounded axial hex coordinate { q, r }
 */
export function worldToHex(x: number, y: number, radius: number): HexCoord {
  if (radius <= 0) {
    throw new RangeError('Hex radius must be positive')
  }
  const qFrac = (Math.sqrt(3) / 3 * x - (1 / 3) * y) / radius
  const rFrac = ((2 / 3) * y) / radius
  const sFrac = -qFrac - rFrac

  let qRound = Math.round(qFrac)
  let rRound = Math.round(rFrac)
  const sRound = Math.round(sFrac)

  const qDiff = Math.abs(qRound - qFrac)
  const rDiff = Math.abs(rRound - rFrac)
  const sDiff = Math.abs(sRound - sFrac)

  if (qDiff > rDiff && qDiff > sDiff) {
    qRound = -rRound - sRound
  } else if (rDiff > sDiff) {
    rRound = -qRound - sRound
  }

  return { q: qRound === 0 ? 0 : qRound, r: rRound === 0 ? 0 : rRound }
}

/**
 * Returns the 6 adjacent axial hex neighbors in canonical order (E, NE, NW, W, SW, SE).
 * @param coord - Center hex coordinate
 * @returns Array of 6 neighboring HexCoord
 */
export function getHexNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map(dir => ({
    q: coord.q + dir.q,
    r: coord.r + dir.r
  }))
}

/**
 * Calculates distance (in hex steps) between two axial coordinates.
 * @param a - First hex coordinate
 * @param b - Second hex coordinate
 * @returns Integer distance in hex steps
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
}

/**
 * Returns all hex coordinates forming a ring of given radius around a center.
 * @param center - Center hex coordinate
 * @param radius - Integer radius of the ring (> 0)
 * @returns Array of HexCoord on the ring perimeter
 */
export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  if (radius <= 0) return [{ q: center.q, r: center.r }]
  const results: HexCoord[] = []

  // Start at SW offset (radius * direction 4)
  let current: HexCoord = {
    q: center.q + HEX_DIRECTIONS[4].q * radius,
    r: center.r + HEX_DIRECTIONS[4].r * radius
  }

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push({ q: current.q, r: current.r })
      current = {
        q: current.q + HEX_DIRECTIONS[i].q,
        r: current.r + HEX_DIRECTIONS[i].r
      }
    }
  }

  return results
}

/**
 * Adapter mapping database location coordinates (x, y) to canonical HexCoord (q, r).
 * @param location - DB location containing x and y
 * @returns Canonical HexCoord
 */
export function getLocationHex(location: Pick<MapLocation, 'x' | 'y'>): HexCoord {
  return { q: location.x, r: location.y }
}
