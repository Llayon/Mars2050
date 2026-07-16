import type { SimUnit } from '../combat.sim.types'
import { FIELD_COMPONENT, createComponentStores, type ComponentName, type EntityId } from './combat-components'

export class CombatWorld {
  readonly stores = createComponentStores()
  readonly externalIdToEntity = new Map<string, EntityId>()
  readonly roster: SimUnit[]
  private readonly views: SimUnit[] = []

  constructor(initialUnits: SimUnit[] = []) {
    this.roster = this.createRoster()
    this.roster.push(...initialUnits)
  }

  createEntity(unit: SimUnit): SimUnit {
    const entityId = this.views.length
    for (const name of Object.keys(this.stores) as ComponentName[]) this.stores[name][entityId] = {}
    for (const field of FIELD_COMPONENT.keys()) this.bindField(entityId, unit, field)
    for (const field of Object.keys(unit) as (keyof SimUnit)[]) {
      if (!FIELD_COMPONENT.has(field)) this.bindField(entityId, unit, field)
    }
    Object.defineProperty(unit, Symbol.for('combat.entityId'), { value: entityId })
    this.views.push(unit)
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

  snapshotEntity(entityId: EntityId): SimUnit {
    return { ...this.views[entityId] }
  }

  snapshot(): SimUnit[] {
    return this.views.map((_, entityId) => this.snapshotEntity(entityId))
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

  private bindField(entityId: EntityId, unit: SimUnit, field: keyof SimUnit): void {
    const owner = FIELD_COMPONENT.get(field) ?? 'mechanics'
    Object.defineProperty(this.stores[owner][entityId], field, {
      enumerable: true,
      configurable: false,
      get: () => unit[field],
      set: value => { (unit as unknown as Record<keyof SimUnit, unknown>)[field] = value },
    })
  }

  private isWorldView(unit: SimUnit): boolean {
    return typeof (unit as unknown as Record<symbol, unknown>)[Symbol.for('combat.entityId')] === 'number'
  }
}
