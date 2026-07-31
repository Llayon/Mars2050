import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE } from '../combat.utils'
import type { EntityId } from './entity'

const CELL_COLUMNS = Math.floor(FIELD_WIDTH / TILE_SIZE) + 1
const CELL_ROWS = Math.floor(FIELD_HEIGHT / TILE_SIZE) + 1
const CELL_COUNT = CELL_COLUMNS * CELL_ROWS

export class TargetingPackedCells {
  readonly offsets = new Uint32Array(CELL_COUNT + 1)
  private readonly counts = new Uint32Array(CELL_COUNT)
  private readonly cursors = new Uint32Array(CELL_COUNT)
  entityIds = new Int32Array(0)

  build(entityIds: readonly EntityId[], x: ArrayLike<number>, y: ArrayLike<number>): void {
    this.counts.fill(0)
    for (const entityId of entityIds) {
      this.counts[getCell(x[entityId], y[entityId])]++
    }

    this.offsets[0] = 0
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      this.offsets[cell + 1] = this.offsets[cell] + this.counts[cell]
      this.cursors[cell] = this.offsets[cell]
    }

    if (this.entityIds.length < entityIds.length) {
      this.entityIds = new Int32Array(nextCapacity(entityIds.length))
    }
    for (const entityId of entityIds) {
      const cell = getCell(x[entityId], y[entityId])
      this.entityIds[this.cursors[cell]++] = entityId
    }
  }
}

export function getTargetingCell(cellX: number, cellY: number): number {
  if (cellX < 0 || cellX >= CELL_COLUMNS || cellY < 0 || cellY >= CELL_ROWS) {
    return -1
  }
  return cellX * CELL_ROWS + cellY
}

export function targetingCellIntersectsCircle(
  cellX: number,
  cellY: number,
  x: number,
  y: number,
  radiusSq: number,
): boolean {
  const left = cellX * TILE_SIZE
  const top = cellY * TILE_SIZE
  const dx = x < left ? left - x : x > left + TILE_SIZE ? x - left - TILE_SIZE : 0
  const dy = y < top ? top - y : y > top + TILE_SIZE ? y - top - TILE_SIZE : 0
  return dx * dx + dy * dy <= radiusSq
}

function getCell(x: number, y: number): number {
  const cellX = clampCell(Math.floor(x / TILE_SIZE), CELL_COLUMNS)
  const cellY = clampCell(Math.floor(y / TILE_SIZE), CELL_ROWS)
  return cellX * CELL_ROWS + cellY
}

function clampCell(value: number, limit: number): number {
  return Math.max(0, Math.min(limit - 1, value))
}

function nextCapacity(required: number): number {
  let capacity = 64
  while (capacity < required) capacity *= 2
  return capacity
}
