import type { SimHazard, SimUnit } from '../combat.sim.types'
import { COMPONENT_FIELDS, FIELD_COMPONENT, createComponentStores, type CombatComponentMap, type ComponentName, type UnitComponentName } from './combat-components'
import { CombatResourceStore } from './combat-resources'
import type { EntityId } from './entity'
import { StructuralCommandBuffer } from './structural-command-buffer'

export class CombatWorld {
  readonly stores = createComponentStores()
  readonly resources = new CombatResourceStore()
  readonly structuralCommands = new StructuralCommandBuffer()
  readonly externalIdToEntity = new Map<string, EntityId>()
  private readonly entityIds: EntityId[] = []
  private nextEntityId = 0

  constructor(initialUnits: SimUnit[] = []) {
    this.queueUnitCreation(...initialUnits)
    this.flushStructuralCommands()
  }

  queueUnitCreation(...units: SimUnit[]): void {
    for (const unit of units) {
      this.structuralCommands.queueUnit(unit)
    }
  }

  queueHazardCreation(...hazards: SimHazard[]): void {
    for (const hazard of hazards) {
      this.structuralCommands.queueHazard(hazard)
    }
  }

  createUnitEntity(unit: SimUnit): EntityId {
    const entityId = this.nextEntityId++
    this.stores.entityMeta.set(entityId, { kind: 'unit', externalId: unit.id })
    this.stores.entityTargets.set(entityId, {})
    for (const name of Object.keys(COMPONENT_FIELDS) as UnitComponentName[]) {
      this.setComponentFromUnit(name, entityId, unit)
    }
    this.assertKnownFields(unit)
    this.entityIds.push(entityId)
    this.externalIdToEntity.set(unit.id, entityId)
    return entityId
  }

  createHazardEntity(hazard: SimHazard): EntityId {
    const entityId = this.nextEntityId++
    this.stores.entityMeta.set(entityId, { kind: 'hazard', externalId: hazard.id })
    this.stores.hazard.set(entityId, structuredClone(hazard))
    this.entityIds.push(entityId)
    this.externalIdToEntity.set(hazard.id, entityId)
    return entityId
  }

  flushStructuralCommands(): void {
    this.structuralCommands.flush(this)
  }

  captureEntityWatermark(): number {
    return this.nextEntityId
  }

  getUnitsCreatedSince(watermark: number): EntityId[] {
    return this.query(['transform', 'vitality']).filter(entityId => entityId >= watermark)
  }

  getHazard(entityId: EntityId): SimHazard | undefined {
    return this.stores.hazard.get(entityId)
  }

  removeHazardEntity(entityId: EntityId): void {
    const hazard = this.stores.hazard.get(entityId)
    if (hazard) this.externalIdToEntity.delete(hazard.id)
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

  snapshotHazards(): SimHazard[] {
    return this.query(['hazard'], true)
      .flatMap(entityId => {
        const hazard = this.stores.hazard.get(entityId)
        return hazard ? [structuredClone(hazard)] : []
      })
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
