import { TILE_SIZE } from '../combat.utils'
import type { SpatialQueryProfile } from '../combat.spatial-profile'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

export class EntitySpatialIndex {
  private readonly cells = new Map<string, EntityId[]>()
  private readonly entityCells = new Map<EntityId, string>()
  private readonly profile: SpatialQueryProfile = {
    queryCount: 0,
    candidateCount: 0,
    maxCandidates: 0,
    bucketCandidateCount: 0,
    rebuildCount: 0,
    incrementalUpdateCount: 0,
    componentQueryCount: 0,
    componentCandidateCount: 0,
    componentResultCount: 0,
    componentCacheHitCount: 0,
  }

  constructor(private readonly cellSize = TILE_SIZE) {}

  rebuild(world: CombatWorld): void {
    this.profile.rebuildCount++
    this.cells.clear()
    this.entityCells.clear()
    for (const entityId of world.query(['transform', 'vitality'])) {
      this.insert(world, entityId)
    }
  }

  insert(world: CombatWorld, entityId: EntityId): void {
    const transform = world.stores.transform.require(entityId)
    const key = this.getCellKey(transform.x, transform.y)
    const bucket = this.cells.get(key)
    if (bucket) bucket.push(entityId)
    else this.cells.set(key, [entityId])
    this.entityCells.set(entityId, key)
  }

  update(world: CombatWorld, entityId: EntityId): void {
    this.profile.incrementalUpdateCount++
    const transform = world.stores.transform.require(entityId)
    const oldKey = this.entityCells.get(entityId)
    const nextKey = this.getCellKey(transform.x, transform.y)
    if (oldKey === nextKey) return
    if (oldKey) {
      const bucket = this.cells.get(oldKey)
      const index = bucket?.indexOf(entityId) ?? -1
      if (bucket && index !== -1) bucket.splice(index, 1)
      if (bucket?.length === 0) this.cells.delete(oldKey)
    }
    this.insert(world, entityId)
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
          this.profile.bucketCandidateCount++
          const transform = world.stores.transform.require(entityId)
          const dx = transform.x - x
          const dy = transform.y - y
          if (dx * dx + dy * dy <= radiusSq) found.push(entityId)
        }
      }
    }
    this.profile.queryCount++
    this.profile.candidateCount += found.length
    this.profile.maxCandidates = Math.max(this.profile.maxCandidates, found.length)
    return found.sort((left, right) => left - right)
  }

  getProfile(world?: CombatWorld): SpatialQueryProfile {
    const component = world?.getQueryProfile()
    return {
      ...this.profile,
      componentQueryCount: component?.queryCount ?? 0,
      componentCandidateCount: component?.candidateCount ?? 0,
      componentResultCount: component?.resultCount ?? 0,
      componentCacheHitCount: component?.cacheHitCount ?? 0,
    }
  }

  private getCellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`
  }
}
