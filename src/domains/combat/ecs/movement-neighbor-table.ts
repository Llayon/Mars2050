import type { EntityId } from './entity'
import type { MovementNeighborLookup } from './movement-batch.types'

export class MovementNeighborTable implements MovementNeighborLookup {
  private readonly counts: Uint8Array
  private readonly entityIds: Int32Array
  private readonly distances: Float64Array

  constructor(
    entityCapacity: number,
    private readonly maxNeighbors: number,
  ) {
    this.counts = new Uint8Array(entityCapacity)
    this.entityIds = new Int32Array(entityCapacity * maxNeighbors)
    this.distances = new Float64Array(entityCapacity * maxNeighbors)
  }

  add(entityId: EntityId, neighborId: EntityId, distanceSquared: number): void {
    const count = this.counts[entityId]
    const base = entityId * this.maxNeighbors
    if (count < this.maxNeighbors) {
      this.counts[entityId] = count + 1
      this.entityIds[base + count] = neighborId
      this.distances[base + count] = distanceSquared
      this.pushWorst(base, count)
    } else if (this.isBetter(neighborId, distanceSquared, base)) {
      this.entityIds[base] = neighborId
      this.distances[base] = distanceSquared
      this.replaceWorst(base, count)
    }
  }

  finalize(entityIds: readonly EntityId[]): void {
    for (const entityId of entityIds) {
      const base = entityId * this.maxNeighbors
      const count = this.counts[entityId]
      for (let index = 1; index < count; index++) {
        const value = this.entityIds[base + index]
        let cursor = index - 1
        while (cursor >= 0 && this.entityIds[base + cursor] > value) {
          this.entityIds[base + cursor + 1] = this.entityIds[base + cursor]
          cursor--
        }
        this.entityIds[base + cursor + 1] = value
      }
    }
  }

  get(entityId: EntityId): Int32Array {
    const base = entityId * this.maxNeighbors
    return this.entityIds.subarray(base, base + this.counts[entityId])
  }

  private pushWorst(base: number, childIndex: number): void {
    let index = childIndex
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (!this.isWorse(base + index, base + parent)) return
      this.swap(base + index, base + parent)
      index = parent
    }
  }

  private replaceWorst(base: number, count: number): void {
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      let worst = index
      if (left < count && this.isWorse(base + left, base + worst)) worst = left
      if (right < count && this.isWorse(base + right, base + worst)) worst = right
      if (worst === index) return
      this.swap(base + index, base + worst)
      index = worst
    }
  }

  private isBetter(
    entityId: EntityId,
    distanceSquared: number,
    currentIndex: number,
  ): boolean {
    const currentDistance = this.distances[currentIndex]
    return distanceSquared < currentDistance ||
      (distanceSquared === currentDistance && entityId < this.entityIds[currentIndex])
  }

  private isWorse(leftIndex: number, rightIndex: number): boolean {
    const leftDistance = this.distances[leftIndex]
    const rightDistance = this.distances[rightIndex]
    return leftDistance > rightDistance ||
      (leftDistance === rightDistance &&
        this.entityIds[leftIndex] > this.entityIds[rightIndex])
  }

  private swap(left: number, right: number): void {
    const entityId = this.entityIds[left]
    const distance = this.distances[left]
    this.entityIds[left] = this.entityIds[right]
    this.distances[left] = this.distances[right]
    this.entityIds[right] = entityId
    this.distances[right] = distance
  }
}
