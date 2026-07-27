import { TILE_SIZE } from '../combat.utils'
import type { SpatialQueryProfile } from '../combat.spatial-profile'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import type { Team } from '../combat.sim.types'
import { queryNearestSpatialCells } from './spatial-nearest'
import { querySpatialPairs } from './spatial-pairs'
import { encodeSpatialCellKey, getSpatialCellColumnBase, type SpatialCellKey } from './spatial-cell-key'
import { createSpatialQueryProfile } from './spatial-query-profile'
export class EntitySpatialIndex {
  private readonly cells = new Map<SpatialCellKey, EntityId[]>()
  private readonly teamCells: Record<Team, Map<SpatialCellKey, EntityId[]>> = {
    attacker: new Map(),
    defender: new Map(),
  }
  private readonly entityCells = new Map<EntityId, SpatialCellKey>()
  private readonly entityTeams = new Map<EntityId, Team>()
  private readonly teamCounts: Record<Team, number> = { attacker: 0, defender: 0 }
  private readonly profile: SpatialQueryProfile = createSpatialQueryProfile()
  private dirty = true

  constructor(
    private readonly cellSize = TILE_SIZE,
    private readonly profilingEnabled = true,
  ) {}

  rebuild(world: CombatWorld): void {
    if (this.profilingEnabled) this.profile.rebuildCount++
    this.cells.clear()
    this.teamCells.attacker.clear()
    this.teamCells.defender.clear()
    this.entityCells.clear()
    this.entityTeams.clear()
    this.teamCounts.attacker = 0
    this.teamCounts.defender = 0
    this.dirty = false
    for (const entityId of world.query(['transform', 'vitality'])) {
      this.insert(world, entityId)
    }
  }

  insert(world: CombatWorld, entityId: EntityId): void {
    if (this.dirty || world.stores.vitality.get(entityId)?.isDead === true) return
    if (this.entityCells.has(entityId)) {
      this.update(world, entityId)
      return
    }
    const transform = world.stores.transform.require(entityId)
    const team = world.stores.identity.require(entityId).team
    const key = this.getCellKey(transform.x, transform.y)
    this.addToCell(this.cells, key, entityId)
    this.addToCell(this.teamCells[team], key, entityId)
    this.entityCells.set(entityId, key)
    this.entityTeams.set(entityId, team)
    this.teamCounts[team]++
  }

  update(world: CombatWorld, entityId: EntityId): void {
    if (this.profilingEnabled) this.profile.incrementalUpdateCount++
    if (this.dirty) return
    if (world.stores.vitality.get(entityId)?.isDead === true) {
      this.remove(entityId)
      return
    }
    const transform = world.stores.transform.require(entityId)
    const oldKey = this.entityCells.get(entityId)
    const nextKey = this.getCellKey(transform.x, transform.y)
    if (oldKey === nextKey) return
    if (oldKey) {
      const bucket = this.cells.get(oldKey)
      const index = bucket?.indexOf(entityId) ?? -1
      if (bucket && index !== -1) bucket.splice(index, 1)
      if (bucket?.length === 0) this.cells.delete(oldKey)
      const team = this.entityTeams.get(entityId)
      if (team) {
        this.removeFromCell(this.teamCells[team], oldKey, entityId)
        this.teamCounts[team]--
      }
      this.entityCells.delete(entityId)
      this.entityTeams.delete(entityId)
    }
    this.insert(world, entityId)
  }
  query(world: CombatWorld, x: number, y: number, radius: number, purpose = 'other'): EntityId[] {
    this.ensureCurrent(world)
    return this.queryCells(world, this.cells, x, y, radius, purpose)
  }
  queryTeam(world: CombatWorld, x: number, y: number, radius: number, team: Team, purpose = 'other'): EntityId[] {
    this.ensureCurrent(world)
    return this.queryCells(world, this.teamCells[team], x, y, radius, purpose)
  }
  queryTeamNearest(
    world: CombatWorld,
    x: number,
    y: number,
    radius: number,
    team: Team,
    maxResults: number,
    purpose = 'other',
  ): EntityId[] {
    this.ensureCurrent(world)
    if (this.teamCounts[team] <= maxResults) {
      return this.queryCells(world, this.teamCells[team], x, y, radius, purpose)
    }
    const result = queryNearestSpatialCells(
      this.teamCells[team],
      this.cellSize,
      x,
      y,
      radius,
      maxResults,
      entityId => world.stores.transform.get(entityId)!,
    )
    this.recordQuery(purpose, result.bucketCandidates, result.entityIds.length)
    return result.entityIds
  }

  queryPairs(
    world: CombatWorld,
    entityIds: readonly EntityId[],
    maxDistance: number,
  ): [EntityId, EntityId][] {
    this.ensureCurrent(world)
    const result = querySpatialPairs(
      world, this.cells, this.cellSize, entityIds, maxDistance, this.profilingEnabled,
    )
    if (this.profilingEnabled) {
      this.profile.pairQueryCount++
      this.profile.pairBucketCandidateCount += result.bucketCandidates
      this.profile.pairResultCount += result.pairs.length
    }
    return result.pairs
  }

  private queryCells(world: CombatWorld, cells: Map<SpatialCellKey, EntityId[]>, x: number, y: number, radius: number, purpose: string): EntityId[] {
    const minCellX = Math.floor((x - radius) / this.cellSize)
    const maxCellX = Math.floor((x + radius) / this.cellSize)
    const minCellY = Math.floor((y - radius) / this.cellSize)
    const maxCellY = Math.floor((y + radius) / this.cellSize)
    const radiusSq = radius * radius
    const found: EntityId[] = []
    let bucketCandidates = 0
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      const columnBase = getSpatialCellColumnBase(cellX)
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const left = cellX * this.cellSize
        const top = cellY * this.cellSize
        const dxToCell = x < left ? left - x : x > left + this.cellSize ? x - left - this.cellSize : 0
        const dyToCell = y < top ? top - y : y > top + this.cellSize ? y - top - this.cellSize : 0
        if (dxToCell * dxToCell + dyToCell * dyToCell > radiusSq) continue
        for (const entityId of cells.get(columnBase + cellY) ?? []) {
          bucketCandidates++
          const transform = world.stores.transform.get(entityId)!
          const dx = transform.x - x
          const dy = transform.y - y
          if (dx * dx + dy * dy <= radiusSq) found.push(entityId)
        }
      }
    }
    this.recordQuery(purpose, bucketCandidates, found.length)
    return found.sort((left, right) => left - right)
  }

  private recordQuery(purpose: string, bucketCandidates: number, candidates: number): void {
    if (!this.profilingEnabled) return
    this.profile.queryCount++
    this.profile.bucketCandidateCount += bucketCandidates
    this.profile.candidateCount += candidates
    this.profile.maxCandidates = Math.max(this.profile.maxCandidates, candidates)
    const purposeProfile = this.profile.purposes[purpose] ?? {
      queryCount: 0,
      bucketCandidateCount: 0,
      candidateCount: 0,
    }
    purposeProfile.queryCount++
    purposeProfile.bucketCandidateCount += bucketCandidates
    purposeProfile.candidateCount += candidates
    this.profile.purposes[purpose] = purposeProfile
  }

  getProfile(world?: CombatWorld): SpatialQueryProfile {
    const component = world?.getQueryProfile()
    return {
      ...this.profile,
      componentQueryCount: component?.queryCount ?? 0,
      componentCandidateCount: component?.candidateCount ?? 0,
      componentResultCount: component?.resultCount ?? 0,
      componentCacheHitCount: component?.cacheHitCount ?? 0,
    }
  }
  ensureCurrent(world: CombatWorld): void {
    if (this.dirty) this.rebuild(world)
  }
  markDirty(): void {
    this.dirty = true
  }
  getTeamEntityCount(team: Team): number {
    return this.teamCounts[team]
  }

  updateTeam(world: CombatWorld, entityId: EntityId): void {
    if (this.dirty) return
    const previous = this.entityTeams.get(entityId)
    const next = world.stores.identity.require(entityId).team
    const key = this.entityCells.get(entityId)
    if (!previous || !key || previous === next) return
    this.removeFromCell(this.teamCells[previous], key, entityId)
    this.teamCounts[previous]--
    this.addToCell(this.teamCells[next], key, entityId)
    this.teamCounts[next]++
    this.entityTeams.set(entityId, next)
  }

  remove(entityId: EntityId): void {
    const key = this.entityCells.get(entityId)
    if (!key) return
    const bucket = this.cells.get(key)
    const index = bucket?.indexOf(entityId) ?? -1
    if (bucket && index !== -1) bucket.splice(index, 1)
    if (bucket?.length === 0) this.cells.delete(key)
    const team = this.entityTeams.get(entityId)
    if (team) {
      this.removeFromCell(this.teamCells[team], key, entityId)
      this.teamCounts[team]--
    }
    this.entityCells.delete(entityId)
    this.entityTeams.delete(entityId)
  }

  private addToCell(cells: Map<SpatialCellKey, EntityId[]>, key: SpatialCellKey, entityId: EntityId): void {
    const bucket = cells.get(key)
    if (bucket) bucket.push(entityId)
    else cells.set(key, [entityId])
  }

  private removeFromCell(cells: Map<SpatialCellKey, EntityId[]>, key: SpatialCellKey, entityId: EntityId): void {
    const bucket = cells.get(key)
    const index = bucket?.indexOf(entityId) ?? -1
    if (bucket && index !== -1) bucket.splice(index, 1)
    if (bucket?.length === 0) cells.delete(key)
  }

  private getCellKey(x: number, y: number): SpatialCellKey {
    return encodeSpatialCellKey(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize))
  }
}
