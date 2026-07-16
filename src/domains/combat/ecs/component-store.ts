import type { EntityId } from './entity'

export class ComponentStore<T extends object> {
  private readonly data: Array<T | undefined> = []

  set(entityId: EntityId, component: T): void {
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
    return true
  }
}
