import type { GridCoord, GridSize } from '@/domains/map/map.types'
import { isCellInBounds, worldToCell } from '@/domains/map/map.grid'

export interface WorldBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/** Minimal converter interface compatible with Viewport.toWorld */
export interface WorldPointConverter {
  toWorld(x: number, y: number): { x: number; y: number }
}

/**
 * Calculates continuous world bounds for a grid of cells.
 */
export function calculateGridWorldBounds(
  width: number,
  height: number,
  cellWorldSize: number
): WorldBounds {
  const minX = 0
  const minY = 0
  const maxX = width * cellWorldSize
  const maxY = height * cellWorldSize

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Maps screen coordinates through viewport into bounded grid coordinates.
 */
export function screenPosToGridCoord(
  converter: WorldPointConverter,
  screenX: number,
  screenY: number,
  cellWorldSize: number,
  size: GridSize
): GridCoord | null {
  const worldPos = converter.toWorld(screenX, screenY)
  const cell = worldToCell(worldPos.x, worldPos.y, cellWorldSize)

  if (!isCellInBounds(cell, size)) {
    return null
  }

  return cell
}

/**
 * Generates all cell coordinates for a logical grid.
 */
export function enumerateGridCells(width: number, height: number): GridCoord[] {
  const cells: GridCoord[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, y })
    }
  }
  return cells
}

/**
 * Computes capped render resolution for optimal mobile/TMA performance and texture memory.
 * Capped at 2.0 to prevent 3x+ DPR mobile devices from over-allocating render buffers.
 */
export function getMapRenderResolution(devicePixelRatio: number = 1): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  return Math.min(Math.max(dpr, 1), 2)
}

