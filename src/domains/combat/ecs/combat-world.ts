import type { SimHazard, SimUnit } from '../combat.sim.types'
import { COMPONENT_FIELDS, FIELD_COMPONENT, createComponentStores, type CombatComponentMap, type ComponentName, type UnitComponentName } from './combat-components'
import { CombatResourceStore } from './combat-resources'
import type { EntityId } from './entity'

export class CombatWorld {
  readonly stores = createComponentStores()
  readonly resources = new CombatResourceStore()
  readonly externalIdToEntity = new Map<string, EntityId>()
  readonly roster: SimUnit[]
  readonly hazards: SimHazard[]
  private readonly views: SimUnit[] = []
  private readonly hazardViews: Array<SimHazard | undefined> = []
  private readonly entityIds: EntityId[] = []
  private nextEntityId = 0

  constructor(initialUnits: SimUnit[] = []) {
    this.roster = this.createRoster()
    this.hazards = this.createHazardRoster()
    this.roster.push(...initialUnits)
  }

  createUnitEntity(unit: SimUnit): EntityId {
    const entityId = this.nextEntityId++
    this.stores.entityMeta.set(entityId, { kind: 'unit', externalId: unit.id })
    for (const name of Object.keys(COMPONENT_FIELDS) as UnitComponentName[]) {
      this.setComponentFromUnit(name, entityId, unit)
    }
    this.assertKnownFields(unit)
    Object.defineProperty(unit, Symbol.for('combat.entityId'), { value: entityId })
    this.views[entityId] = unit
    this.entityIds.push(entityId)
    this.externalIdToEntity.set(unit.id, entityId)
    return entityId
  }

  createHazardEntity(hazard: SimHazard): EntityId {
    const entityId = this.nextEntityId++
    this.stores.entityMeta.set(entityId, { kind: 'hazard', externalId: hazard.id })
    this.stores.hazard.set(entityId, structuredClone(hazard))
    this.hazardViews[entityId] = hazard
    this.entityIds.push(entityId)
    this.externalIdToEntity.set(hazard.id, entityId)
    return entityId
  }

  getEntity(entityId: EntityId): SimUnit | undefined {
    return this.views[entityId]
  }

  getByExternalId(externalId: string): SimUnit | undefined {
    const entityId = this.externalIdToEntity.get(externalId)
    return entityId === undefined ? undefined : this.views[entityId]
  }

  getHazard(entityId: EntityId): SimHazard | undefined {
    return this.stores.hazard.get(entityId)
  }

  removeHazardEntity(entityId: EntityId): void {
    const view = this.hazardViews[entityId]
    if (view) {
      const index = this.hazards.indexOf(view)
      if (index !== -1) this.hazards.splice(index, 1)
      this.externalIdToEntity.delete(view.id)
    }
    this.hazardViews[entityId] = undefined
    this.stores.hazard.delete(entityId)
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

  getComponent<Name extends ComponentName>(componentName: Name, entityId: EntityId): CombatComponentMap[Name] | undefined {
    return this.stores[componentName].get(entityId)
  }

  syncEntityToComponents(entityId: EntityId): void {
    const view = this.views[entityId]
    if (!view) return
    for (const field of Object.keys(view) as (keyof SimUnit)[]) {
      const owner = FIELD_COMPONENT.get(field)
      if (!owner) throw new Error(`Unmapped SimUnit field: ${String(field)}`)
      ;(this.stores[owner].require(entityId) as Record<keyof SimUnit, unknown>)[field] = view[field]
    }
  }

  syncEntityFromComponents(entityId: EntityId): void {
    const view = this.views[entityId]
    if (!view) return
    for (const name of Object.keys(COMPONENT_FIELDS) as UnitComponentName[]) {
      Object.assign(view, this.stores[name].get(entityId))
    }
  }

  syncComponentsToStore(entityId: EntityId, componentNames: readonly UnitComponentName[]): void {
    const view = this.views[entityId]
    if (!view) return
    for (const componentName of componentNames) {
      const component = this.stores[componentName].require(entityId)
      const fields = COMPONENT_FIELDS[componentName]
      for (const field of fields) {
        ;(component as Record<keyof SimUnit, unknown>)[field] = view[field]
      }
    }
  }

  syncComponentsFromStore(entityId: EntityId, componentNames: readonly UnitComponentName[]): void {
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

  syncAllComponentsToStore(componentNames: readonly UnitComponentName[]): void {
    for (const entityId of this.entityIds) this.syncComponentsToStore(entityId, componentNames)
  }

  syncAllComponentsFromStore(componentNames: readonly UnitComponentName[]): void {
    for (const entityId of this.entityIds) this.syncComponentsFromStore(entityId, componentNames)
  }

  snapshotEntity(entityId: EntityId): SimUnit {
    const snapshot: Record<string, unknown> = {}
    for (const name of Object.keys(COMPONENT_FIELDS) as UnitComponentName[]) {
      Object.assign(snapshot, this.stores[name].get(entityId))
    }
    return structuredClone(snapshot) as unknown as SimUnit
  }

  snapshot(): SimUnit[] {
    return this.entityIds
      .filter(entityId => this.stores.entityMeta.get(entityId)?.kind === 'unit')
      .map(entityId => this.snapshotEntity(entityId))
  }

  reconcileHazards(): void {
    const activeIds = new Set(this.hazards.map(hazard => hazard.id))
    for (const entityId of this.entityIds) {
      const meta = this.stores.entityMeta.get(entityId)
      if (meta?.kind !== 'hazard') continue
      if (!activeIds.has(meta.externalId)) {
        this.stores.hazard.delete(entityId)
        this.hazardViews[entityId] = undefined
        this.externalIdToEntity.delete(meta.externalId)
        continue
      }
      const view = this.hazardViews[entityId]
      if (view) this.stores.hazard.set(entityId, structuredClone(view))
    }
  }

  syncHazardsToComponents(): void {
    for (const entityId of this.entityIds) {
      const view = this.hazardViews[entityId]
      if (view && this.stores.hazard.has(entityId)) this.stores.hazard.set(entityId, structuredClone(view))
    }
  }

  syncHazardsFromComponents(): void {
    for (const entityId of this.entityIds) {
      const view = this.hazardViews[entityId]
      const hazard = this.stores.hazard.get(entityId)
      if (view && hazard) Object.assign(view, structuredClone(hazard))
    }
  }

  private createRoster(): SimUnit[] {
    const values: SimUnit[] = []
    return new Proxy(values, {
      get: (target, property, receiver) => {
        if (property === 'push') {
          return (...units: SimUnit[]) => {
            for (const unit of units) {
              if (!this.isWorldView(unit)) this.createUnitEntity(unit)
              target.push(unit)
            }
            return target.length
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })
  }

  private createHazardRoster(): SimHazard[] {
    const values: SimHazard[] = []
    return new Proxy(values, {
      get: (target, property, receiver) => {
        if (property === 'push') {
          return (...hazards: SimHazard[]) => {
            for (const hazard of hazards) {
              target.push(hazard)
              this.createHazardEntity(hazard)
            }
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

  private setComponentFromUnit<Name extends UnitComponentName>(name: Name, entityId: EntityId, unit: SimUnit): void {
    const component: Record<string, unknown> = {}
    for (const field of COMPONENT_FIELDS[name]) {
      if (field in unit) component[field] = unit[field]
    }
    this.stores[name].set(entityId, component as CombatComponentMap[Name])
  }

  private assertKnownFields(unit: SimUnit): void {
    for (const field of Object.keys(unit) as (keyof SimUnit)[]) {
      if (!FIELD_COMPONENT.has(field)) throw new Error(`Unmapped SimUnit field: ${String(field)}`)
    }
  }
}
