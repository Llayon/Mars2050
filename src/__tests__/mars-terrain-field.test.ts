import { describe, it, expect } from 'vitest'
import { DEFAULT_MAP_SEED } from '@/domains/map/map.config'
import {
  generateTerrainVisualField,
  getTerrainVisualCell,
  terrainCellKey,
  hashCoord,
  hash1D
} from '@/components/map/mars-terrain-field'
import { TERRAIN_BIOMES, type TerrainVisualField } from '@/components/map/mars-terrain.types'

/**
 * Computes ratio of 4-way orthogonal neighbors that share the same biome.
 */
function computeSameBiomeNeighborRatio(field: TerrainVisualField): number {
  let sameCount = 0
  let totalEdges = 0

  for (let y = 0; y < field.height; y++) {
    for (let x = 0; x < field.width; x++) {
      const current = getTerrainVisualCell(field, x, y)!
      const right = getTerrainVisualCell(field, x + 1, y)
      const down = getTerrainVisualCell(field, x, y + 1)

      if (right) {
        totalEdges++
        if (right.biome === current.biome) sameCount++
      }
      if (down) {
        totalEdges++
        if (down.biome === current.biome) sameCount++
      }
    }
  }

  return totalEdges > 0 ? sameCount / totalEdges : 1
}

describe('mars-terrain-field (Deterministic Biome Visual Field)', () => {
  it('produces identical output for identical seed and dimensions (pure determinism)', () => {
    const field1 = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const field2 = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })

    expect(field1.regions).toEqual(field2.regions)
    expect(field1.cells.length).toBe(400)
    expect(field1.cells).toEqual(field2.cells)
  })

  it('produces divergent terrain for different seeds', () => {
    const field1 = generateTerrainVisualField({ width: 20, height: 20, seed: 1001 })
    const field2 = generateTerrainVisualField({ width: 20, height: 20, seed: 2002 })

    expect(field1.regions[0].centerX).not.toEqual(field2.regions[0].centerX)
    expect(field1.cells.map(c => c.biome)).not.toEqual(field2.cells.map(c => c.biome))
  })

  it('enforces normalized value ranges [0..1] for all visual properties', () => {
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })

    for (const cell of field.cells) {
      expect(cell.elevation).toBeGreaterThanOrEqual(0)
      expect(cell.elevation).toBeLessThanOrEqual(1)

      expect(cell.roughness).toBeGreaterThanOrEqual(0)
      expect(cell.roughness).toBeLessThanOrEqual(1)

      expect(cell.dust).toBeGreaterThanOrEqual(0)
      expect(cell.dust).toBeLessThanOrEqual(1)

      expect(TERRAIN_BIOMES).toContain(cell.biome)
      expect(cell.regionId).toBeGreaterThanOrEqual(0)
      expect(cell.regionId).toBeLessThan(field.regions.length)
    }
  })

  it('excludes polar biome by default', () => {
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const hasPolar = field.cells.some(c => c.biome === 'polar')
    expect(hasPolar).toBe(false)
  })

  it('exhibits high macro-region neighbor cohesion (ratio > 0.65)', () => {
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })
    const cohesionRatio = computeSameBiomeNeighborRatio(field)

    // Cohesive macro regions typically achieve > 0.75 without single-cell salt-and-pepper noise
    expect(cohesionRatio).toBeGreaterThan(0.65)
  })

  it('correctly provides cell lookup and cell keys', () => {
    const field = generateTerrainVisualField({ width: 20, height: 20, seed: DEFAULT_MAP_SEED })

    const cell = getTerrainVisualCell(field, 5, 10)
    expect(cell).not.toBeNull()
    expect(cell?.x).toBe(5)
    expect(cell?.y).toBe(10)

    expect(getTerrainVisualCell(field, -1, 0)).toBeNull()
    expect(getTerrainVisualCell(field, 20, 20)).toBeNull()

    expect(terrainCellKey(3, 7)).toBe('3,7')
  })

  it('provides deterministic 32-bit integer hashes with Math.imul', () => {
    const h1 = hashCoord(1234, 5, 8, 42)
    const h2 = hashCoord(1234, 5, 8, 42)
    expect(h1).toBe(h2)
    expect(h1).toBeGreaterThanOrEqual(0)
    expect(h1).toBeLessThanOrEqual(0xffffffff)

    const h1D_1 = hash1D(9999, 4, 10)
    const h1D_2 = hash1D(9999, 4, 10)
    expect(h1D_1).toBe(h1D_2)
  })
})
