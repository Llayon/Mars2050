import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE } from '../combat.utils.js'
import type { EntityId } from './entity.js'

export const DEFAULT_CELL_COLUMNS = Math.floor(FIELD_WIDTH / TILE_SIZE) + 1
export const DEFAULT_CELL_ROWS = Math.floor(FIELD_HEIGHT / TILE_SIZE) + 1
export const DEFAULT_CELL_COUNT = DEFAULT_CELL_COLUMNS * DEFAULT_CELL_ROWS

export interface PackedMovementCells {
  readonly offsets: Uint32Array
  readonly entityIds: Int32Array
  readonly occupiedCells: Int32Array
  readonly occupiedCount: number
  readonly cellColumns: number
  readonly cellRows: number
  readonly cellCount: number
  readonly tileSize: number
}

export function buildPackedMovementCells(
  entityIds: readonly EntityId[],
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  arena?: { width: number; height: number; tileSize?: number },
): PackedMovementCells {
  const width = arena?.width ?? FIELD_WIDTH
  const height = arena?.height ?? FIELD_HEIGHT
  const tileSize = arena?.tileSize ?? TILE_SIZE
  const cellColumns = Math.floor(width / tileSize) + 1
  const cellRows = Math.floor(height / tileSize) + 1
  const cellCount = cellColumns * cellRows

  const counts = new Uint32Array(cellCount)
  const occupiedCells = new Int32Array(Math.min(entityIds.length, cellCount))
  let occupiedCount = 0
  for (const entityId of entityIds) {
    const cell = getPackedMovementCell(x[entityId], y[entityId], cellColumns, cellRows, tileSize)
    if (counts[cell] === 0) occupiedCells[occupiedCount++] = cell
    counts[cell]++
  }

  const offsets = new Uint32Array(cellCount + 1)
  for (let cell = 0; cell < cellCount; cell++) {
    offsets[cell + 1] = offsets[cell] + counts[cell]
  }
  const cursors = offsets.slice(0, cellCount)
  const packedEntityIds = new Int32Array(entityIds.length)
  for (const entityId of entityIds) {
    const cell = getPackedMovementCell(x[entityId], y[entityId], cellColumns, cellRows, tileSize)
    packedEntityIds[cursors[cell]++] = entityId
  }
  return { offsets, entityIds: packedEntityIds, occupiedCells, occupiedCount, cellColumns, cellRows, cellCount, tileSize }
}

export function getPackedMovementCell(
  x: number,
  y: number,
  cellColumns = DEFAULT_CELL_COLUMNS,
  cellRows = DEFAULT_CELL_ROWS,
  tileSize = TILE_SIZE,
): number {
  return getPackedMovementCellX(x, cellColumns, tileSize) * cellRows + getPackedMovementCellY(y, cellRows, tileSize)
}

export function getPackedMovementCellX(x: number, cellColumns = DEFAULT_CELL_COLUMNS, tileSize = TILE_SIZE): number {
  return clampCell(Math.floor(x / tileSize), cellColumns)
}

export function getPackedMovementCellY(y: number, cellRows = DEFAULT_CELL_ROWS, tileSize = TILE_SIZE): number {
  return clampCell(Math.floor(y / tileSize), cellRows)
}

export function getPackedMovementCellCoordinates(cell: number, cellRows = DEFAULT_CELL_ROWS): {
  cellX: number
  cellY: number
} {
  return {
    cellX: Math.floor(cell / cellRows),
    cellY: cell % cellRows,
  }
}

export function getPackedMovementCellByCoordinates(
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

function clampCell(value: number, limit: number): number {
  return Math.max(0, Math.min(limit - 1, value))
}
