import { TILE_SIZE } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

export class EntitySpatialIndex {
  private readonly cells = new Map<string, EntityId[]>()

  constructor(private readonly cellSize = TILE_SIZE) {}

  rebuild(world: CombatWorld): void {
    this.cells.clear()
    for (const entityId of world.query(['transform', 'vitality'])) {
      const transform = world.stores.transform.require(entityId)
      const key = this.getCellKey(transform.x, transform.y)
      const bucket = this.cells.get(key)
      if (bucket) bucket.push(entityId)
      else this.cells.set(key, [entityId])
    }
  }

  query(world: CombatWorld, x: number, y: number, radius: number): EntityId[] {
    const minCellX = Math.floor((x - radius) / this.cellSize)
    const maxCellX = Math.floor((x + radius) / this.cellSize)
    const minCellY = Math.floor((y - radius) / this.cellSize)
    const maxCellY = Math.floor((y + radius) / this.cellSize)
    const radiusSq = radius * radius
    const found: EntityId[] = []
    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        for (const entityId of this.cells.get(`${cellX}:${cellY}`) ?? []) {
          const transform = world.stores.transform.require(entityId)
          const dx = transform.x - x
          const dy = transform.y - y
          if (dx * dx + dy * dy <= radiusSq) found.push(entityId)
        }
      }
    }
    return found.sort((left, right) => left - right)
  }

  private getCellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`
  }
}
