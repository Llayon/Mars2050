import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE } from '../combat.utils'
import type { EntityId } from './entity'

const CELL_COLUMNS = Math.floor(FIELD_WIDTH / TILE_SIZE) + 1
const CELL_ROWS = Math.floor(FIELD_HEIGHT / TILE_SIZE) + 1
const CELL_COUNT = CELL_COLUMNS * CELL_ROWS

export interface PackedMovementCells {
  readonly offsets: Uint32Array
  readonly entityIds: Int32Array
  readonly occupiedCells: Int32Array
  readonly occupiedCount: number
}

export function buildPackedMovementCells(
  entityIds: readonly EntityId[],
  x: ArrayLike<number>,
  y: ArrayLike<number>,
): PackedMovementCells {
  const counts = new Uint32Array(CELL_COUNT)
  const occupiedCells = new Int32Array(Math.min(entityIds.length, CELL_COUNT))
  let occupiedCount = 0
  for (const entityId of entityIds) {
    const cell = getPackedMovementCell(x[entityId], y[entityId])
    if (counts[cell] === 0) occupiedCells[occupiedCount++] = cell
    counts[cell]++
  }

  const offsets = new Uint32Array(CELL_COUNT + 1)
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    offsets[cell + 1] = offsets[cell] + counts[cell]
  }
  const cursors = offsets.slice(0, CELL_COUNT)
  const packedEntityIds = new Int32Array(entityIds.length)
  for (const entityId of entityIds) {
    const cell = getPackedMovementCell(x[entityId], y[entityId])
    packedEntityIds[cursors[cell]++] = entityId
  }
  return { offsets, entityIds: packedEntityIds, occupiedCells, occupiedCount }
}

export function getPackedMovementCell(x: number, y: number): number {
  return getPackedMovementCellX(x) * CELL_ROWS + getPackedMovementCellY(y)
}

export function getPackedMovementCellX(x: number): number {
  return clampCell(Math.floor(x / TILE_SIZE), CELL_COLUMNS)
}

export function getPackedMovementCellY(y: number): number {
  return clampCell(Math.floor(y / TILE_SIZE), CELL_ROWS)
}

export function getPackedMovementCellCoordinates(cell: number): {
  cellX: number
  cellY: number
} {
  return {
    cellX: Math.floor(cell / CELL_ROWS),
    cellY: cell % CELL_ROWS,
  }
}

export function getPackedMovementCellByCoordinates(
  cellX: number,
  cellY: number,
): number {
  if (cellX < 0 || cellX >= CELL_COLUMNS || cellY < 0 || cellY >= CELL_ROWS) {
    return -1
  }
  return cellX * CELL_ROWS + cellY
}

function clampCell(value: number, limit: number): number {
  return Math.max(0, Math.min(limit - 1, value))
}
