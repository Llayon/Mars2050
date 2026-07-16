import type { SimUnit } from '../combat.sim.types'
import { COMPONENT_FIELDS, FIELD_COMPONENT, createComponentStores, type ComponentName } from './combat-components'
import type { EntityId } from './entity'

export class CombatWorld {
  readonly stores = createComponentStores()
  readonly externalIdToEntity = new Map<string, EntityId>()
  readonly roster: SimUnit[]
  private readonly views: SimUnit[] = []
  private readonly entityIds: EntityId[] = []
  private nextEntityId = 0

  constructor(initialUnits: SimUnit[] = []) {
    this.roster = this.createRoster()
    this.roster.push(...initialUnits)
  }

  createEntity(unit: SimUnit): SimUnit {
    const entityId = this.nextEntityId++
    for (const name of Object.keys(this.stores) as ComponentName[]) this.stores[name].set(entityId, {})
    for (const field of Object.keys(unit) as (keyof SimUnit)[]) {
      const owner = FIELD_COMPONENT.get(field) ?? 'mechanics'
      ;(this.stores[owner].require(entityId) as Record<keyof SimUnit, unknown>)[field] = unit[field]
    }
    Object.defineProperty(unit, Symbol.for('combat.entityId'), { value: entityId })
    this.views[entityId] = unit
    this.entityIds.push(entityId)
    this.externalIdToEntity.set(unit.id, entityId)
    return unit
  }

  getEntity(entityId: EntityId): SimUnit | undefined {
    return this.views[entityId]
  }

  getByExternalId(externalId: string): SimUnit | undefined {
    const entityId = this.externalIdToEntity.get(externalId)
    return entityId === undefined ? undefined : this.views[entityId]
  }

  getEntityId(externalId: string): EntityId | undefined {
    return this.externalIdToEntity.get(externalId)
  }

  query(componentNames: readonly ComponentName[], includeDead = false): EntityId[] {
    return this.entityIds.filter(entityId => {
      if (!componentNames.every(name => this.stores[name].has(entityId))) return false
      if (includeDead) return true
      return this.stores.vitality.get(entityId)?.isDead !== true
    })
  }

  getComponent(componentName: ComponentName, entityId: EntityId) {
    return this.stores[componentName].get(entityId)
  }

  syncEntityToComponents(entityId: EntityId): void {
    const view = this.views[entityId]
    if (!view) return
    for (const field of Object.keys(view) as (keyof SimUnit)[]) {
      const owner = FIELD_COMPONENT.get(field) ?? 'mechanics'
      ;(this.stores[owner].require(entityId) as Record<keyof SimUnit, unknown>)[field] = view[field]
    }
  }

  syncEntityFromComponents(entityId: EntityId): void {
    const view = this.views[entityId]
    if (!view) return
    for (const store of Object.values(this.stores)) Object.assign(view, store.get(entityId))
  }

  syncComponentsToStore(entityId: EntityId, componentNames: readonly ComponentName[]): void {
    const view = this.views[entityId]
    if (!view) return
    for (const componentName of componentNames) {
      const component = this.stores[componentName].require(entityId)
      const fields = componentName === 'mechanics'
        ? Object.keys(component) as (keyof SimUnit)[]
        : COMPONENT_FIELDS[componentName]
      for (const field of fields) {
        ;(component as Record<keyof SimUnit, unknown>)[field] = view[field]
      }
    }
  }

  syncComponentsFromStore(entityId: EntityId, componentNames: readonly ComponentName[]): void {
    const view = this.views[entityId]
    if (!view) return
    for (const componentName of componentNames) Object.assign(view, this.stores[componentName].get(entityId))
  }

  syncAllToComponents(): void {
    for (const entityId of this.entityIds) this.syncEntityToComponents(entityId)
  }

  syncAllFromComponents(): void {
    for (const entityId of this.entityIds) this.syncEntityFromComponents(entityId)
  }

  syncAllComponentsToStore(componentNames: readonly ComponentName[]): void {
    for (const entityId of this.entityIds) this.syncComponentsToStore(entityId, componentNames)
  }

  syncAllComponentsFromStore(componentNames: readonly ComponentName[]): void {
    for (const entityId of this.entityIds) this.syncComponentsFromStore(entityId, componentNames)
  }

  snapshotEntity(entityId: EntityId): SimUnit {
    const snapshot: Record<string, unknown> = {}
    for (const store of Object.values(this.stores)) Object.assign(snapshot, store.get(entityId))
    return structuredClone(snapshot) as unknown as SimUnit
  }

  snapshot(): SimUnit[] {
    return this.entityIds.map(entityId => this.snapshotEntity(entityId))
  }

  private createRoster(): SimUnit[] {
    const values: SimUnit[] = []
    return new Proxy(values, {
      get: (target, property, receiver) => {
        if (property === 'push') {
          return (...units: SimUnit[]) => {
            for (const unit of units) target.push(this.isWorldView(unit) ? unit : this.createEntity(unit))
            return target.length
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })
  }

  private isWorldView(unit: SimUnit): boolean {
    return typeof (unit as unknown as Record<symbol, unknown>)[Symbol.for('combat.entityId')] === 'number'
  }
}
