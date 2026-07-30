import { TILE_SIZE } from '../combat.utils'
import type { EntityId } from './entity'
import {
  buildPackedMovementCells,
  getPackedMovementCellByCoordinates,
  getPackedMovementCellCoordinates,
  getPackedMovementCellX,
  getPackedMovementCellY,
  type PackedMovementCells,
} from './movement-packed-cells'

export function buildMovementCollisionPairs(
  entityIds: readonly EntityId[],
  x: readonly number[],
  y: readonly number[],
  dirtyEntities: ReadonlySet<EntityId>,
  searchDistance: number,
): [EntityId, EntityId][] {
  const cells = buildPackedMovementCells(entityIds, x, y)
  const reach = Math.ceil(searchDistance / TILE_SIZE)
  const radiusSquared = searchDistance * searchDistance
  if (dirtyEntities.size * 2 < entityIds.length) {
    return buildDirtyPairs(entityIds, x, y, dirtyEntities, cells, reach, radiusSquared)
  }
  return buildAllPairs(x, y, cells, reach, radiusSquared)
}

function buildDirtyPairs(
  entityIds: readonly EntityId[],
  x: readonly number[],
  y: readonly number[],
  dirtyEntities: ReadonlySet<EntityId>,
  cells: PackedMovementCells,
  reach: number,
  radiusSquared: number,
): [EntityId, EntityId][] {
  const pairs: [EntityId, EntityId][] = []
  const pairKeys = new Set<number>()
  const span = (entityIds[entityIds.length - 1] ?? 0) + 1
  for (const firstId of [...dirtyEntities].sort((left, right) => left - right)) {
    if (x[firstId] === undefined) continue
    const cellX = getPackedMovementCellX(x[firstId])
    const cellY = getPackedMovementCellY(y[firstId])
    for (let offsetX = -reach; offsetX <= reach; offsetX++) {
      for (let offsetY = -reach; offsetY <= reach; offsetY++) {
        const cell = getPackedMovementCellByCoordinates(
          cellX + offsetX,
          cellY + offsetY,
        )
        if (cell < 0) continue
        for (let index = cells.offsets[cell]; index < cells.offsets[cell + 1]; index++) {
          const secondId = cells.entityIds[index]
          if (secondId === firstId) continue
          const lower = Math.min(firstId, secondId)
          const upper = Math.max(firstId, secondId)
          const pairKey = lower * span + upper
          if (pairKeys.has(pairKey) || !isWithinRadius(lower, upper, x, y, radiusSquared)) {
            continue
          }
          pairKeys.add(pairKey)
          pairs.push([lower, upper])
        }
      }
    }
  }
  return pairs.sort((left, right) => left[0] - right[0] || left[1] - right[1])
}

function buildAllPairs(
  x: readonly number[],
  y: readonly number[],
  cells: PackedMovementCells,
  reach: number,
  radiusSquared: number,
): [EntityId, EntityId][] {
  const pairs: [EntityId, EntityId][] = []
  for (let occupied = 0; occupied < cells.occupiedCount; occupied++) {
    const firstCell = cells.occupiedCells[occupied]
    addBucketPairs(pairs, cells, firstCell, firstCell, true, x, y, radiusSquared)
    const { cellX, cellY } = getPackedMovementCellCoordinates(firstCell)
    for (let offsetX = -reach; offsetX <= reach; offsetX++) {
      for (let offsetY = -reach; offsetY <= reach; offsetY++) {
        const secondCell = getPackedMovementCellByCoordinates(
          cellX + offsetX,
          cellY + offsetY,
        )
        if (secondCell <= firstCell ||
            cells.offsets[secondCell] === cells.offsets[secondCell + 1]) continue
        addBucketPairs(pairs, cells, firstCell, secondCell, false, x, y, radiusSquared)
      }
    }
  }
  return pairs
}

function addBucketPairs(
  pairs: [EntityId, EntityId][],
  cells: PackedMovementCells,
  firstCell: number,
  secondCell: number,
  sameBucket: boolean,
  x: readonly number[],
  y: readonly number[],
  radiusSquared: number,
): void {
  const firstStart = cells.offsets[firstCell]
  const firstEnd = cells.offsets[firstCell + 1]
  const secondStart = cells.offsets[secondCell]
  const secondEnd = cells.offsets[secondCell + 1]
  for (let left = firstStart; left < firstEnd; left++) {
    for (let right = sameBucket ? left + 1 : secondStart; right < secondEnd; right++) {
      const firstId = cells.entityIds[left]
      const secondId = cells.entityIds[right]
      if (!isWithinRadius(firstId, secondId, x, y, radiusSquared)) continue
      pairs.push(firstId < secondId ? [firstId, secondId] : [secondId, firstId])
    }
  }
}

function isWithinRadius(
  firstId: EntityId,
  secondId: EntityId,
  x: readonly number[],
  y: readonly number[],
  radiusSquared: number,
): boolean {
  const dx = x[secondId] - x[firstId]
  const dy = y[secondId] - y[firstId]
  return dx * dx + dy * dy <= radiusSquared
}
