import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

export class CombatSourceIndex {
  private readonly pendingStatusSources = new Map<EntityId, Record<string, string>>()
  private readonly pendingEntitySources = new Map<EntityId, {
    targetMarkSource?: string
    controlProgressSource?: string
    hazardSource?: string
  }>()

  queueStatusSources(entityId: EntityId, sources: Record<string, string>): void {
    if (Object.keys(sources).length > 0) this.pendingStatusSources.set(entityId, sources)
  }

  queueEntitySources(
    entityId: EntityId,
    sources: { targetMarkSource?: string; controlProgressSource?: string; hazardSource?: string },
  ): void {
    if (sources.targetMarkSource || sources.controlProgressSource || sources.hazardSource) {
      this.pendingEntitySources.set(entityId, sources)
    }
  }

  resolvePending(world: CombatWorld): void {
    for (const [entityId, sources] of this.pendingStatusSources) {
      for (const [statusKey, externalId] of Object.entries(sources)) {
        const sourceId = world.getEntityId(externalId)
        if (sourceId !== undefined && world.stores.identity.has(sourceId)) {
          this.set(world, entityId, statusKey, sourceId)
          delete sources[statusKey]
        } else if (!world.externalIds.isReserved(externalId)) {
          delete sources[statusKey]
        }
      }
      if (Object.keys(sources).length === 0) this.pendingStatusSources.delete(entityId)
    }
    for (const [entityId, sources] of this.pendingEntitySources) {
      sources.targetMarkSource = this.resolveUnitSource(world, sources.targetMarkSource,
        sourceId => { world.stores.entitySources.require(entityId).targetMarkSource = sourceId })
      sources.controlProgressSource = this.resolveUnitSource(world, sources.controlProgressSource,
        sourceId => { world.stores.entitySources.require(entityId).controlProgressSource = sourceId })
      sources.hazardSource = this.resolveUnitSource(world, sources.hazardSource,
        sourceId => { world.stores.entitySources.require(entityId).hazardSource = sourceId })
      if (!sources.targetMarkSource && !sources.controlProgressSource && !sources.hazardSource) {
        this.pendingEntitySources.delete(entityId)
      }
    }
  }

  set(world: CombatWorld, entityId: EntityId, statusKey: string, sourceId?: EntityId): void {
    const sources = world.stores.entitySources.require(entityId).statusSources
    if (sourceId !== undefined && world.stores.identity.has(sourceId)) sources[statusKey] = sourceId
    else delete sources[statusKey]
  }

  setExternal(
    world: CombatWorld,
    entityId: EntityId,
    statusKey: string,
    sourceExternalId?: string,
  ): void {
    const sourceId = sourceExternalId === undefined
      ? undefined
      : world.getEntityId(sourceExternalId)
    this.set(world, entityId, statusKey, sourceId)
  }

  get(world: CombatWorld, entityId: EntityId, statusKey: string): EntityId | undefined {
    return world.stores.entitySources.require(entityId).statusSources[statusKey]
  }

  clear(world: CombatWorld, entityId: EntityId, statusKey: string): void {
    delete world.stores.entitySources.require(entityId).statusSources[statusKey]
  }

  clearAll(world: CombatWorld, entityId: EntityId): void {
    world.stores.entitySources.require(entityId).statusSources = {}
    this.pendingStatusSources.delete(entityId)
    this.pendingEntitySources.delete(entityId)
  }

  private resolveUnitSource(
    world: CombatWorld,
    externalId: string | undefined,
    assign: (sourceId: EntityId) => void,
  ): string | undefined {
    if (!externalId) return undefined
    const sourceId = world.getEntityId(externalId)
    if (sourceId !== undefined && world.stores.identity.has(sourceId)) {
      assign(sourceId)
      return undefined
    }
    return world.externalIds.isReserved(externalId) ? externalId : undefined
  }
}
