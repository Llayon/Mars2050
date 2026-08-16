import { describe, it, expect } from 'vitest'
import {
  calculateGridWorldBounds,
  screenPosToGridCoord,
  enumerateGridCells,
  getMapRenderResolution
} from '@/components/map/mars-map-projection'

describe('mars-map-projection', () => {
  it('calculates continuous world bounds accurately', () => {
    const bounds = calculateGridWorldBounds(20, 20, 128)
    expect(bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 2560,
      maxY: 2560,
      width: 2560,
      height: 2560
    })
  })

  it('maps screen coordinates to bounded grid cell using mock converter', () => {
    const mockConverter = {
      toWorld: (x: number, y: number) => ({ x: x * 2, y: y * 2 })
    }

    // (64, 64) -> world (128, 128) -> cell (1, 1) with cellSize=128
    const cell = screenPosToGridCoord(mockConverter, 64, 64, 128, { width: 20, height: 20 })
    expect(cell).toEqual({ x: 1, y: 1 })

    // Out of bounds coordinate -> returns null
    const oobCell = screenPosToGridCoord(mockConverter, 2000, 2000, 128, { width: 20, height: 20 })
    expect(oobCell).toBeNull()

    // Negative coordinate -> returns null
    const negCell = screenPosToGridCoord(mockConverter, -50, 20, 128, { width: 20, height: 20 })
    expect(negCell).toBeNull()
  })

  it('enumerates all 400 cells for a 20x20 grid', () => {
    const cells = enumerateGridCells(20, 20)
    expect(cells).toHaveLength(400)
    expect(cells[0]).toEqual({ x: 0, y: 0 })
    expect(cells[399]).toEqual({ x: 19, y: 19 })
  })

  it('caps map render resolution at 2.0 to protect mobile TMA performance', () => {
    // Standard desktop / 1x screen
    expect(getMapRenderResolution(1)).toBe(1)
    // 1.5x intermediate screen
    expect(getMapRenderResolution(1.5)).toBe(1.5)
    // 2x Retina / standard high-DPI mobile
    expect(getMapRenderResolution(2)).toBe(2)
    // 3x high-end mobile flagship -> must be capped at 2.0
    expect(getMapRenderResolution(3)).toBe(2)
    // 4x extreme mobile screen -> capped at 2.0
    expect(getMapRenderResolution(4)).toBe(2)
    // Fallbacks for missing or invalid window.devicePixelRatio
    expect(getMapRenderResolution(0)).toBe(1)
    expect(getMapRenderResolution(NaN)).toBe(1)
    expect(getMapRenderResolution(undefined)).toBe(1)
  })
})
