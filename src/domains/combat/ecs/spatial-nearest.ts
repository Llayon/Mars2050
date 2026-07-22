import type { EntityId } from './entity'

interface Candidate {
  entityId: EntityId
  distanceSq: number
}

export function queryNearestSpatialCells(
  cells: Map<string, EntityId[]>,
  cellSize: number,
  x: number,
  y: number,
  radius: number,
  maxResults: number,
  getPosition: (entityId: EntityId) => { x: number; y: number },
): { entityIds: EntityId[]; bucketCandidates: number } {
  const radiusSq = radius * radius
  const heap: Candidate[] = []
  let bucketCandidates = 0
  for (const cell of getOrderedCells(cellSize, x, y, radius)) {
    if (cell.minDistanceSq > radiusSq) break
    if (heap.length >= maxResults && cell.minDistanceSq > heap[0].distanceSq) break
    for (const entityId of cells.get(cell.key) ?? []) {
      bucketCandidates++
      const position = getPosition(entityId)
      const dx = position.x - x
      const dy = position.y - y
      const candidate = { entityId, distanceSq: dx * dx + dy * dy }
      if (candidate.distanceSq > radiusSq) continue
      if (heap.length < maxResults) pushHeap(heap, candidate)
      else if (isBetter(candidate, heap[0])) replaceHeapRoot(heap, candidate)
    }
  }
  return {
    entityIds: heap.map(candidate => candidate.entityId)
      .sort((left, right) => left - right),
    bucketCandidates,
  }
}

function getOrderedCells(cellSize: number, x: number, y: number, radius: number) {
  const minCellX = Math.floor((x - radius) / cellSize)
  const maxCellX = Math.floor((x + radius) / cellSize)
  const minCellY = Math.floor((y - radius) / cellSize)
  const maxCellY = Math.floor((y + radius) / cellSize)
  const cells: { key: string; cellX: number; cellY: number; minDistanceSq: number }[] = []
  for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      const left = cellX * cellSize
      const top = cellY * cellSize
      const dx = x < left ? left - x : x > left + cellSize ? x - left - cellSize : 0
      const dy = y < top ? top - y : y > top + cellSize ? y - top - cellSize : 0
      cells.push({ key: `${cellX}:${cellY}`, cellX, cellY, minDistanceSq: dx * dx + dy * dy })
    }
  }
  return cells.sort((left, right) =>
    left.minDistanceSq - right.minDistanceSq ||
    left.cellY - right.cellY || left.cellX - right.cellX,
  )
}

function pushHeap(heap: Candidate[], candidate: Candidate): void {
  heap.push(candidate)
  let index = heap.length - 1
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2)
    if (!isWorse(heap[index], heap[parent])) break
    ;[heap[index], heap[parent]] = [heap[parent], heap[index]]
    index = parent
  }
}

function replaceHeapRoot(heap: Candidate[], candidate: Candidate): void {
  heap[0] = candidate
  let index = 0
  while (true) {
    const left = index * 2 + 1
    const right = left + 1
    let worst = index
    if (left < heap.length && isWorse(heap[left], heap[worst])) worst = left
    if (right < heap.length && isWorse(heap[right], heap[worst])) worst = right
    if (worst === index) return
    ;[heap[index], heap[worst]] = [heap[worst], heap[index]]
    index = worst
  }
}

function isBetter(left: Candidate, right: Candidate): boolean {
  return left.distanceSq < right.distanceSq ||
    (left.distanceSq === right.distanceSq && left.entityId < right.entityId)
}

function isWorse(left: Candidate, right: Candidate): boolean {
  return left.distanceSq > right.distanceSq ||
    (left.distanceSq === right.distanceSq && left.entityId > right.entityId)
}
