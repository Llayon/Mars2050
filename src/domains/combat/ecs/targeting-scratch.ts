import type { EntityId } from './entity'

const INITIAL_TARGETING_CAPACITY = 64

export class TargetingScratch {
  entityIds = new Int32Array(INITIAL_TARGETING_CAPACITY)
  distances = new Float64Array(INITIAL_TARGETING_CAPACITY)
  eligible = new Uint8Array(INITIAL_TARGETING_CAPACITY)
  length = 0
  growthCount = 0
  liveTeamFiltered = false

  reset(): void {
    this.length = 0
    this.liveTeamFiltered = false
  }

  push(entityId: EntityId, distance = Number.NaN): void {
    this.ensureCapacity(this.length + 1)
    this.entityIds[this.length] = entityId
    this.distances[this.length] = distance
    this.length++
  }

  fill(entityIds: readonly EntityId[]): void {
    this.reset()
    this.ensureCapacity(entityIds.length)
    for (let index = 0; index < entityIds.length; index++) {
      this.entityIds[index] = entityIds[index]
      this.distances[index] = Number.NaN
    }
    this.length = entityIds.length
  }

  private ensureCapacity(required: number): void {
    if (required <= this.entityIds.length) return
    let capacity = this.entityIds.length
    while (capacity < required) capacity *= 2
    this.entityIds = copyInt32(this.entityIds, capacity)
    this.distances = copyFloat64(this.distances, capacity)
    this.eligible = copyUint8(this.eligible, capacity)
    this.growthCount++
  }
}

function copyInt32(
  source: Int32Array<ArrayBufferLike>,
  capacity: number,
): Int32Array<ArrayBuffer> {
  const result = new Int32Array(capacity)
  result.set(source)
  return result
}

function copyFloat64(
  source: Float64Array<ArrayBufferLike>,
  capacity: number,
): Float64Array<ArrayBuffer> {
  const result = new Float64Array(capacity)
  result.set(source)
  return result
}

function copyUint8(
  source: Uint8Array<ArrayBufferLike>,
  capacity: number,
): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(capacity)
  result.set(source)
  return result
}
