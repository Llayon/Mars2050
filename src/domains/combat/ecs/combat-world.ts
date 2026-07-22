import type { SimHazard, SimUnit } from '../combat.sim.types'
import { COMPONENT_FIELDS, FIELD_COMPONENT, createComponentStores, type CombatComponentMap, type ComponentName, type UnitCapabilityName, type UnitComponentName } from './combat-components'
import { ComponentQueryRegistry, type ComponentQueryProfile } from './component-query-registry'
import { CombatResourceStore } from './combat-resources'
import type { EntityId } from './entity'
import { CombatInvariantError } from './combat-invariant-error'
import { ExternalIdAllocator } from './external-id-allocator'
import type { QuerySpec } from './query-spec'
import { StructuralCommandBuffer } from './structural-command-buffer'
import { captureUnitClone, type UnitCloneData } from './unit-clone'
import { installCapabilityNames, installUnitCapabilities, setUnitCapabilityPresence } from './unit-capabilities'
import { createHazardSnapshots, createUnitSnapshot, createUnitSnapshots } from './combat-world-snapshot'
import { captureUnitRelations, resolveUnitRelations, type PendingUnitRelations } from './unit-relation-codec'

export type { ComponentQueryProfile } from './component-query-registry'

export class CombatWorld {
  readonly stores = createComponentStores()
  readonly resources = new CombatResourceStore()
  readonly structuralCommands = new StructuralCommandBuffer()
  readonly externalIds = new ExternalIdAllocator()
  readonly externalIdToEntity = new Map<string, EntityId>()
  private readonly entityIds: EntityId[] = []
  private readonly queries: ComponentQueryRegistry
  private readonly pendingRelations = new Map<EntityId, PendingUnitRelations>()
  private nextEntityId = 0

  constructor(initialUnits: SimUnit[] = [], options: { profile?: boolean } = {}) {
    this.queries = new ComponentQueryRegistry(options.profile !== false)
    this.queueUnitCreation(...initialUnits)
    this.flushStructuralCommands()
  }

  queueUnitCreation(...units: SimUnit[]): void {
    for (const unit of units) {
      this.externalIds.reserve(unit.id)
      this.structuralCommands.queueUnit(unit)
    }
  }

  queueHazardCreation(...hazards: SimHazard[]): void {
    for (const hazard of hazards) {
      this.externalIds.reserve(hazard.id)
      this.structuralCommands.queueHazard(hazard)
    }
  }

  queueUnitClone(sourceId: EntityId, externalId: string, x: number, y: number): void {
    this.externalIds.reserve(externalId)
    this.structuralCommands.queueUnitClone(captureUnitClone(this, sourceId, externalId, x, y))
  }

  createUnitEntity(unit: SimUnit): EntityId {
    this.assertKnownFields(unit)
    const entityId = this.createUnitRecord(
      unit.id,
      (name, entityId) => { this.setComponentFromUnit(name, entityId, unit) },
      captureUnitRelations(unit),
    )
    installUnitCapabilities(this.stores, entityId, unit)
    return entityId
  }

  createHazardEntity(hazard: SimHazard): EntityId {
    this.assertPendingExternalId(hazard.id)
    const entityId = this.nextEntityId++
    this.stores.entityMeta.set(entityId, { kind: 'hazard', externalId: hazard.id })
    this.stores.hazard.set(entityId, structuredClone(hazard))
    this.entityIds.push(entityId)
    this.externalIdToEntity.set(hazard.id, entityId)
    this.queries.touchStructure()
    return entityId
  }

  createClonedUnitEntity(clone: UnitCloneData): EntityId {
    const entityId = this.createUnitRecord(
      clone.externalId,
      (name, entityId) => { this.setClonedComponent(name, entityId, clone) },
    )
    installCapabilityNames(this.stores, entityId, clone.capabilities)
    return entityId
  }

  flushStructuralCommands(): void {
    this.structuralCommands.flush(this)
    for (const [entityId, pending] of this.pendingRelations) {
      if (resolveUnitRelations(this, entityId, pending)) {
        this.pendingRelations.delete(entityId)
      }
    }
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
    if (this.stores.hazard.delete(entityId)) {
      this.stores.hazard.compactIfNeeded()
      this.stores.entityMeta.delete(entityId)
      this.stores.entityMeta.compactIfNeeded()
      this.queries.touchStructure()
    }
  }

  getEntityId(externalId: string): EntityId | undefined {
    return this.externalIdToEntity.get(externalId)
  }

  allocateExternalId(namespace: string): string {
    return this.externalIds.allocate(namespace)
  }

  preferExternalId(externalId: string): string {
    return this.externalIds.prefer(externalId)
  }

  query(query: readonly ComponentName[] | QuerySpec, includeDead = false): readonly EntityId[] {
    return this.queries.query(this.stores, query, includeDead)
  }

  setEntityDead(entityId: EntityId, isDead: boolean): void {
    const vitality = this.stores.vitality.require(entityId)
    if (vitality.isDead === isDead) return
    vitality.isDead = isDead
    this.queries.touchAlive()
    const spatial = this.resources.get('entitySpatial')
    if (isDead) spatial?.remove(entityId)
    else spatial?.insert(this, entityId)
  }

  syncEntitySpatialPosition(entityId: EntityId): void {
    this.resources.get('entitySpatial')?.update(this, entityId)
  }

  setEntityTeam(entityId: EntityId, team: SimUnit['team']): void {
    const identity = this.stores.identity.require(entityId)
    if (identity.team === team) return
    identity.team = team
    this.resources.get('entitySpatial')?.updateTeam(this, entityId)
  }

  setUnitCapability(entityId: EntityId, capability: UnitCapabilityName, present: boolean): void {
    if (setUnitCapabilityPresence(this.stores, entityId, capability, present)) {
      this.queries.touchStructure()
    }
  }

  getQueryProfile(): ComponentQueryProfile {
    return this.queries.getProfile()
  }

  getComponent<Name extends ComponentName>(componentName: Name, entityId: EntityId): CombatComponentMap[Name] | undefined {
    return this.stores[componentName].get(entityId)
  }

  snapshotEntity(entityId: EntityId): SimUnit {
    return createUnitSnapshot(this, entityId, this.pendingRelations.get(entityId))
  }

  snapshot(): SimUnit[] {
    return createUnitSnapshots(this, this.entityIds, entityId => this.pendingRelations.get(entityId))
  }

  snapshotHazards(): SimHazard[] {
    return createHazardSnapshots(this)
  }

  private setComponentFromUnit<Name extends UnitComponentName>(name: Name, entityId: EntityId, unit: SimUnit): void {
    const component: Record<string, unknown> = {}
    for (const field of COMPONENT_FIELDS[name]) {
      if (field in unit) component[field] = unit[field]
    }
    this.stores[name].set(
      entityId,
      structuredClone(component) as unknown as CombatComponentMap[Name],
    )
  }

  private createUnitRecord(
    externalId: string,
    setComponents: (name: UnitComponentName, entityId: EntityId) => void,
    pendingRelations?: PendingUnitRelations,
  ): EntityId {
    this.assertPendingExternalId(externalId)
    const entityId = this.nextEntityId++
    this.stores.entityMeta.set(entityId, { kind: 'unit', externalId })
    this.stores.entityTargets.set(entityId, {})
    if (pendingRelations) this.pendingRelations.set(entityId, pendingRelations)
    for (const name of Object.keys(COMPONENT_FIELDS) as UnitComponentName[]) setComponents(name, entityId)
    this.entityIds.push(entityId)
    this.externalIdToEntity.set(externalId, entityId)
    this.queries.touchStructure()
    this.resources.get('entitySpatial')?.insert(this, entityId)
    return entityId
  }

  private setClonedComponent<Name extends UnitComponentName>(name: Name, entityId: EntityId, clone: UnitCloneData): void {
    this.stores[name].set(
      entityId,
      structuredClone(clone.components[name]) as CombatComponentMap[Name],
    )
  }

  private assertKnownFields(unit: SimUnit): void {
    for (const field of Object.keys(unit) as (keyof SimUnit)[]) {
      if (!FIELD_COMPONENT.has(field)) throw new Error(`Unmapped SimUnit field: ${String(field)}`)
    }
  }

  private assertPendingExternalId(externalId: string): void {
    if (!this.externalIds.isReserved(externalId)) {
      throw new CombatInvariantError(`Unreserved external entity id: ${externalId}`)
    }
    if (this.externalIdToEntity.has(externalId)) {
      throw new CombatInvariantError(`Duplicate committed entity id: ${externalId}`)
    }
  }

}
