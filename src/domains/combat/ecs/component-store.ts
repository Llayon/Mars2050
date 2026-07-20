import type { EntityId } from './entity'

export class ComponentStore<T extends object> {
  private readonly data: Array<T | undefined> = []
  private entityIds: EntityId[] = []
  private trackedIds = new Set<EntityId>()
  private tombstones = 0

  set(entityId: EntityId, component: T): void {
    if (!this.trackedIds.has(entityId)) {
      this.entityIds.push(entityId)
      this.trackedIds.add(entityId)
    } else if (!this.has(entityId)) {
      this.tombstones--
    }
    this.data[entityId] = component
  }

  get(entityId: EntityId): T | undefined {
    return this.data[entityId]
  }

  require(entityId: EntityId): T {
    const component = this.get(entityId)
    if (!component) throw new Error(`Missing component for entity ${entityId}`)
    return component
  }

  has(entityId: EntityId): boolean {
    return this.data[entityId] !== undefined
  }

  delete(entityId: EntityId): boolean {
    if (!this.has(entityId)) return false
    this.data[entityId] = undefined
    this.tombstones++
    return true
  }

  getEntityIds(): readonly EntityId[] {
    return this.entityIds
  }

  getActiveCount(): number {
    return this.entityIds.length - this.tombstones
  }

  compactIfNeeded(): void {
    if (this.tombstones === 0 || this.tombstones * 4 <= this.entityIds.length) return
    this.entityIds = this.entityIds.filter(entityId => this.has(entityId))
    this.trackedIds = new Set(this.entityIds)
    this.tombstones = 0
  }
}
