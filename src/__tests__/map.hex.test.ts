import { describe, it, expect } from 'vitest'
import {
  hexToWorld,
  worldToHex,
  getHexNeighbors,
  hexDistance,
  hexRing,
  getLocationHex,
  HEX_DIRECTIONS
} from '@/domains/map/map.hex'
import type { HexCoord } from '@/domains/map/map.types'

describe('map.hex (Pointy-Top Axial Math)', () => {
  const TEST_RADII = [16, 32, 64, 128]

  it('preserves coordinate round-trip: worldToHex(hexToWorld(q, r)) === (q, r)', () => {
    for (const radius of TEST_RADII) {
      for (let q = -10; q <= 10; q++) {
        for (let r = -10; r <= 10; r++) {
          const original: HexCoord = { q, r }
          const world = hexToWorld(original, radius)
          const reconstructed = worldToHex(world.x, world.y, radius)
          expect(reconstructed.q, `radius=${radius} q mismatch at (${q},${r})`).toBe(q)
          expect(reconstructed.r, `radius=${radius} r mismatch at (${q},${r})`).toBe(r)
        }
      }
    }
  })

  it('throws RangeError when radius is zero or negative', () => {
    expect(() => hexToWorld({ q: 0, r: 0 }, 0)).toThrow(RangeError)
    expect(() => hexToWorld({ q: 0, r: 0 }, -5)).toThrow(RangeError)
    expect(() => worldToHex(0, 0, 0)).toThrow(RangeError)
    expect(() => worldToHex(0, 0, -10)).toThrow(RangeError)
  })

  it('has 6 canonical directions in order E -> NE -> NW -> W -> SW -> SE', () => {
    expect(HEX_DIRECTIONS).toEqual([
      { q: 1, r: 0 },   // E
      { q: 1, r: -1 },  // NE
      { q: 0, r: -1 },  // NW
      { q: -1, r: 0 },  // W
      { q: -1, r: 1 },  // SW
      { q: 0, r: 1 }    // SE
    ])
  })

  it('getHexNeighbors returns 6 adjacent coordinates with distance 1', () => {
    const center: HexCoord = { q: 3, r: -2 }
    const neighbors = getHexNeighbors(center)

    expect(neighbors.length).toBe(6)
    for (const neighbor of neighbors) {
      expect(hexDistance(center, neighbor)).toBe(1)
    }
  })

  it('calculates hex distance with symmetry and identity', () => {
    const a: HexCoord = { q: 2, r: 3 }
    const b: HexCoord = { q: -4, r: 5 }

    expect(hexDistance(a, a)).toBe(0)
    expect(hexDistance(a, b)).toBe(hexDistance(b, a))
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3)
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: -4 })).toBe(4)
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -2 })).toBe(2)
  })

  it('hexRing generates 6 * radius hexes at exact distance', () => {
    const center: HexCoord = { q: 0, r: 0 }
    expect(hexRing(center, 0)).toEqual([{ q: 0, r: 0 }])

    for (let radius = 1; radius <= 4; radius++) {
      const ring = hexRing(center, radius)
      expect(ring.length).toBe(6 * radius)
      const uniqueCoords = new Set(ring.map(c => `${c.q},${c.r}`))
      expect(uniqueCoords.size).toBe(ring.length)

      for (const coord of ring) {
        expect(hexDistance(center, coord)).toBe(radius)
      }
    }
  })

  it('getLocationHex maps x/y correctly to axial q/r', () => {
    const location = { x: 7, y: -3 }
    const hex = getLocationHex(location)
    expect(hex).toEqual({ q: 7, r: -3 })
  })
})
