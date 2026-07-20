import type { SimHazard, SimUnit } from '../combat.sim.types'
import { COMPONENT_FIELDS, FIELD_COMPONENT, createComponentStores, type CombatComponentMap, type ComponentName, type UnitComponentName } from './combat-components'
import { CombatResourceStore } from './combat-resources'
import type { EntityId } from './entity'
import { CombatInvariantError } from './combat-invariant-error'
import { ExternalIdAllocator } from './external-id-allocator'
import { getQueryMask, isQuerySpec, type QuerySpec } from './query-spec'
import { StructuralCommandBuffer } from './structural-command-buffer'

export interface ComponentQueryProfile {
  queryCount: number
  candidateCount: number
  resultCount: number
  cacheHitCount: number
}

interface QueryCacheEntry {
  structureRevision: number
  aliveRevision: number
  entityIds: EntityId[]
}

export class CombatWorld {
  readonly stores = createComponentStores()
  readonly resources = new CombatResourceStore()
  readonly structuralCommands = new StructuralCommandBuffer()
  readonly externalIds = new ExternalIdAllocator()
  readonly externalIdToEntity = new Map<string, EntityId>()
  private readonly entityIds: EntityId[] = []
  private readonly queryCache = new Map<string, QueryCacheEntry>()
  private readonly queryProfile: ComponentQueryProfile = {
    queryCount: 0,
    candidateCount: 0,
    resultCount: 0,
    cacheHitCount: 0,
  }
  private nextEntityId = 0
  private structureRevision = 0
  private aliveRevision = 0

  constructor(initialUnits: SimUnit[] = []) {
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

  createUnitEntity(unit: SimUnit): EntityId {
    this.assertPendingExternalId(unit.id)
    const entityId = this.nextEntityId++
    this.stores.entityMeta.set(entityId, { kind: 'unit', externalId: unit.id })
    this.stores.entityTargets.set(entityId, {})
    for (const name of Object.keys(COMPONENT_FIELDS) as UnitComponentName[]) {
      this.setComponentFromUnit(name, entityId, unit)
    }
    this.assertKnownFields(unit)
    this.entityIds.push(entityId)
    this.externalIdToEntity.set(unit.id, entityId)
    this.structureRevision++
    this.resources.get('entitySpatial')?.insert(this, entityId)
    return entityId
  }

  createHazardEntity(hazard: SimHazard): EntityId {
    this.assertPendingExternalId(hazard.id)
    const entityId = this.nextEntityId++
    this.stores.entityMeta.set(entityId, { kind: 'hazard', externalId: hazard.id })
    this.stores.hazard.set(entityId, structuredClone(hazard))
    this.entityIds.push(entityId)
    this.externalIdToEntity.set(hazard.id, entityId)
    this.structureRevision++
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
    if (this.stores.hazard.delete(entityId)) {
      this.stores.hazard.compactIfNeeded()
      this.structureRevision++
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

  query(query: readonly ComponentName[] | QuerySpec, includeDead = false): EntityId[] {
    this.queryProfile.queryCount++
    const componentNames = isQuerySpec(query) ? query.components : query
    const mask = isQuerySpec(query) ? query.mask : getQueryMask(query)
    const key = `${mask}:${includeDead ? 1 : 0}`
    const cached = this.queryCache.get(key)
    if (cached && cached.structureRevision === this.structureRevision &&
        (includeDead || cached.aliveRevision === this.aliveRevision)) {
      this.queryProfile.cacheHitCount++
      this.queryProfile.resultCount += cached.entityIds.length
      return [...cached.entityIds]
    }
    const candidates = this.getSmallestComponentStore(componentNames).getEntityIds()
    this.queryProfile.candidateCount += candidates.length
    const result = candidates.filter(entityId => {
      if (!componentNames.every(name => this.stores[name].has(entityId))) return false
      if (includeDead) return true
      return this.stores.vitality.get(entityId)?.isDead !== true
    }).sort((left, right) => left - right)
    this.queryProfile.resultCount += result.length
    this.queryCache.set(key, {
      structureRevision: this.structureRevision,
      aliveRevision: this.aliveRevision,
      entityIds: result,
    })
    return [...result]
  }

  setEntityDead(entityId: EntityId, isDead: boolean): void {
    const vitality = this.stores.vitality.require(entityId)
    if (vitality.isDead === isDead) return
    vitality.isDead = isDead
    this.aliveRevision++
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

  getQueryProfile(): ComponentQueryProfile {
    return { ...this.queryProfile }
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
    this.stores[name].set(
      entityId,
      structuredClone(component) as unknown as CombatComponentMap[Name],
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

  private getSmallestComponentStore(componentNames: readonly ComponentName[]) {
    const first = componentNames[0]
    if (!first) return this.stores.entityMeta
    let smallest = this.stores[first]
    for (const name of componentNames.slice(1)) {
      const candidate = this.stores[name]
      if (candidate.getActiveCount() < smallest.getActiveCount()) smallest = candidate
    }
    return smallest
  }
}
