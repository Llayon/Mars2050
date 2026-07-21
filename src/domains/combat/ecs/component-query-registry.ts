import type { CombatComponentStores, ComponentName } from './combat-components'
import type { EntityId } from './entity'
import { getQueryMask, isQuerySpec, type QuerySpec } from './query-spec'

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

export class ComponentQueryRegistry {
  private readonly cache = new Map<string, QueryCacheEntry>()
  private readonly profile: ComponentQueryProfile = {
    queryCount: 0,
    candidateCount: 0,
    resultCount: 0,
    cacheHitCount: 0,
  }
  private structureRevision = 0
  private aliveRevision = 0

  touchStructure(): void {
    this.structureRevision++
  }

  touchAlive(): void {
    this.aliveRevision++
  }

  query(
    stores: CombatComponentStores,
    query: readonly ComponentName[] | QuerySpec,
    includeDead: boolean,
  ): EntityId[] {
    this.profile.queryCount++
    const componentNames = isQuerySpec(query) ? query.components : query
    const mask = isQuerySpec(query) ? query.mask : getQueryMask(query)
    const key = `${mask}:${includeDead ? 1 : 0}`
    const cached = this.cache.get(key)
    if (cached && cached.structureRevision === this.structureRevision &&
        (includeDead || cached.aliveRevision === this.aliveRevision)) {
      this.profile.cacheHitCount++
      this.profile.resultCount += cached.entityIds.length
      return [...cached.entityIds]
    }
    const candidates = getSmallestComponentStore(stores, componentNames).getEntityIds()
    this.profile.candidateCount += candidates.length
    const result = candidates.filter(entityId => {
      if (!componentNames.every(name => stores[name].has(entityId))) return false
      return includeDead || stores.vitality.get(entityId)?.isDead !== true
    }).sort((left, right) => left - right)
    this.profile.resultCount += result.length
    this.cache.set(key, {
      structureRevision: this.structureRevision,
      aliveRevision: this.aliveRevision,
      entityIds: result,
    })
    return [...result]
  }

  getProfile(): ComponentQueryProfile {
    return { ...this.profile }
  }
}

function getSmallestComponentStore(
  stores: CombatComponentStores,
  componentNames: readonly ComponentName[],
) {
  const first = componentNames[0]
  if (!first) return stores.entityMeta
  let smallest = stores[first]
  for (const name of componentNames.slice(1)) {
    const candidate = stores[name]
    if (candidate.getActiveCount() < smallest.getActiveCount()) smallest = candidate
  }
  return smallest
}
