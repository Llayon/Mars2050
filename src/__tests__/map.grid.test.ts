import { describe, it, expect } from 'vitest'
import {
  cellToWorld,
  worldToCell,
  isCellInBounds,
  getCellNeighbors4,
  type GridCoord,
  type GridSize
} from '@/domains/map/map.grid'

describe('map.grid (Rectangular Grid Math)', () => {
  it('converts cell to world center and back deterministically', () => {
    const cellSize = 128
    const coord: GridCoord = { x: 5, y: 10 }
    const worldPos = cellToWorld(coord, cellSize)

    expect(worldPos).toEqual({ x: 5.5 * 128, y: 10.5 * 128 })
    expect(worldToCell(worldPos.x, worldPos.y, cellSize)).toEqual(coord)

    // Test corners of the cell round to the same cell
    expect(worldToCell(5 * 128 + 1, 10 * 128 + 1, cellSize)).toEqual(coord)
    expect(worldToCell(6 * 128 - 1, 11 * 128 - 1, cellSize)).toEqual(coord)
  })

  it('correctly checks bounds for 20x20 grid', () => {
    const size: GridSize = { width: 20, height: 20 }
    expect(isCellInBounds({ x: 0, y: 0 }, size)).toBe(true)
    expect(isCellInBounds({ x: 19, y: 19 }, size)).toBe(true)
    expect(isCellInBounds({ x: 20, y: 19 }, size)).toBe(false)
    expect(isCellInBounds({ x: 0, y: 20 }, size)).toBe(false)
    expect(isCellInBounds({ x: -1, y: 5 }, size)).toBe(false)
    expect(isCellInBounds({ x: 5, y: -1 }, size)).toBe(false)
  })

  it('returns exactly 4 cardinal neighbors', () => {
    const neighbors = getCellNeighbors4({ x: 5, y: 5 })
    expect(neighbors).toHaveLength(4)
    expect(neighbors).toEqual([
      { x: 6, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 4 }
    ])
  })
})
