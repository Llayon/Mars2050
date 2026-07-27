import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { encodeSpatialCellKey, type SpatialCellKey } from './spatial-cell-key'

export function querySpatialPairs(
  world: CombatWorld,
  cells: ReadonlyMap<SpatialCellKey, readonly EntityId[]>,
  cellSize: number,
  entityIds: readonly EntityId[],
  maxDistance: number,
  profile: boolean,
): { pairs: [EntityId, EntityId][]; bucketCandidates: number } {
  const cellReach = Math.ceil(maxDistance / cellSize)
  const maxDistanceSquared = maxDistance * maxDistance
  const pairs: [EntityId, EntityId][] = []
  let bucketCandidates = 0
  for (const firstId of entityIds) {
    const first = world.stores.transform.get(firstId)!
    const cellX = Math.floor(first.x / cellSize)
    const cellY = Math.floor(first.y / cellSize)
    for (let offsetY = -cellReach; offsetY <= cellReach; offsetY++) {
      for (let offsetX = -cellReach; offsetX <= cellReach; offsetX++) {
        const key = encodeSpatialCellKey(cellX + offsetX, cellY + offsetY)
        const bucket = cells.get(key) ?? []
        if (profile) bucketCandidates += bucket.length
        for (const secondId of bucket) {
          if (secondId <= firstId) continue
          const second = world.stores.transform.get(secondId)!
          const dx = second.x - first.x
          const dy = second.y - first.y
          if (dx * dx + dy * dy < maxDistanceSquared) pairs.push([firstId, secondId])
        }
      }
    }
  }
  return {
    pairs: pairs.sort((left, right) => left[0] - right[0] || left[1] - right[1]),
    bucketCandidates,
  }
}
