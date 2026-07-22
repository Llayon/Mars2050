import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

export function querySpatialPairs(
  world: CombatWorld,
  cells: ReadonlyMap<string, readonly EntityId[]>,
  cellSize: number,
  entityIds: readonly EntityId[],
  maxDistance: number,
): [EntityId, EntityId][] {
  const cellReach = Math.ceil(maxDistance / cellSize)
  const maxDistanceSquared = maxDistance * maxDistance
  const pairs: [EntityId, EntityId][] = []
  for (const firstId of entityIds) {
    const first = world.stores.transform.require(firstId)
    const cellX = Math.floor(first.x / cellSize)
    const cellY = Math.floor(first.y / cellSize)
    for (let offsetY = -cellReach; offsetY <= cellReach; offsetY++) {
      for (let offsetX = -cellReach; offsetX <= cellReach; offsetX++) {
        for (const secondId of cells.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
          if (secondId <= firstId) continue
          const second = world.stores.transform.require(secondId)
          const dx = second.x - first.x
          const dy = second.y - first.y
          if (dx * dx + dy * dy < maxDistanceSquared) pairs.push([firstId, secondId])
        }
      }
    }
  }
  return pairs.sort((left, right) => left[0] - right[0] || left[1] - right[1])
}
