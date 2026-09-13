import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE } from '../combat.utils.js'
import type { EntityId } from './entity.js'

export const DEFAULT_CELL_COLUMNS = Math.floor(FIELD_WIDTH / TILE_SIZE) + 1
export const DEFAULT_CELL_ROWS = Math.floor(FIELD_HEIGHT / TILE_SIZE) + 1
export const DEFAULT_CELL_COUNT = DEFAULT_CELL_COLUMNS * DEFAULT_CELL_ROWS

export class TargetingPackedCells {
  cellColumns: number = DEFAULT_CELL_COLUMNS
  cellRows: number = DEFAULT_CELL_ROWS
  cellCount: number = DEFAULT_CELL_COUNT
  tileSize: number = TILE_SIZE
  offsets = new Uint32Array(DEFAULT_CELL_COUNT + 1)
  private counts = new Uint32Array(DEFAULT_CELL_COUNT)
  private cursors = new Uint32Array(DEFAULT_CELL_COUNT)
  entityIds = new Int32Array(0)

  reconfigure(arena?: { width: number; height: number; tileSize?: number }): void {
    const width = arena?.width ?? FIELD_WIDTH
    const height = arena?.height ?? FIELD_HEIGHT
    const tileSize = arena?.tileSize ?? TILE_SIZE
    const cellColumns = Math.floor(width / tileSize) + 1
    const cellRows = Math.floor(height / tileSize) + 1
    const cellCount = cellColumns * cellRows
    if (this.cellCount === cellCount && this.cellColumns === cellColumns && this.tileSize === tileSize) {
      return
    }
    this.cellColumns = cellColumns
    this.cellRows = cellRows
    this.cellCount = cellCount
    this.tileSize = tileSize
    this.offsets = new Uint32Array(cellCount + 1)
    this.counts = new Uint32Array(cellCount)
    this.cursors = new Uint32Array(cellCount)
  }

  build(entityIds: readonly EntityId[], x: ArrayLike<number>, y: ArrayLike<number>): void {
    this.counts.fill(0)
    for (const entityId of entityIds) {
      this.counts[this.getCell(x[entityId], y[entityId])]++
    }

    this.offsets[0] = 0
    for (let cell = 0; cell < this.cellCount; cell++) {
      this.offsets[cell + 1] = this.offsets[cell] + this.counts[cell]
      this.cursors[cell] = this.offsets[cell]
    }

    if (this.entityIds.length < entityIds.length) {
      this.entityIds = new Int32Array(nextCapacity(entityIds.length))
    }
    for (const entityId of entityIds) {
      const cell = this.getCell(x[entityId], y[entityId])
      this.entityIds[this.cursors[cell]++] = entityId
    }
  }

  getCell(x: number, y: number): number {
    const cellX = clampCell(Math.floor(x / this.tileSize), this.cellColumns)
    const cellY = clampCell(Math.floor(y / this.tileSize), this.cellRows)
    return cellX * this.cellRows + cellY
  }
}

export function getTargetingCell(
  cellX: number,
  cellY: number,
  cellColumns = DEFAULT_CELL_COLUMNS,
  cellRows = DEFAULT_CELL_ROWS,
): number {
  if (cellX < 0 || cellX >= cellColumns || cellY < 0 || cellY >= cellRows) {
    return -1
  }
  return cellX * cellRows + cellY
}

export function targetingCellIntersectsCircle(
  cellX: number,
  cellY: number,
  x: number,
  y: number,
  radiusSq: number,
  tileSize = TILE_SIZE,
): boolean {
  const left = cellX * tileSize
  const top = cellY * tileSize
  const dx = x < left ? left - x : x > left + tileSize ? x - left - tileSize : 0
  const dy = y < top ? top - y : y > top + tileSize ? y - top - tileSize : 0
  return dx * dx + dy * dy <= radiusSq
}

function clampCell(value: number, limit: number): number {
  return Math.max(0, Math.min(limit - 1, value))
}

function nextCapacity(required: number): number {
  let capacity = 64
  while (capacity < required) capacity *= 2
  return capacity
}
