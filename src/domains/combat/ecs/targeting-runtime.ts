import type { Team } from '../combat.sim.types'
import { TILE_SIZE } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import {
  getTargetingCell,
  TargetingPackedCells,
  targetingCellIntersectsCircle,
} from './targeting-packed-cells'
import {
  createTargetingRuntimeProfile,
  type TargetingRuntimeProfile,
} from './targeting-runtime-profile'
import { TargetingScratch } from './targeting-scratch'

type TargetTeam = Team | 'all'

const TARGETABLE_QUERY = ['identity', 'transform', 'vitality'] as const

export class TargetingRuntime {
  readonly scratch = new TargetingScratch()
  private readonly teamCells: Record<Team, TargetingPackedCells> = {
    attacker: new TargetingPackedCells(),
    defender: new TargetingPackedCells(),
  }
  private readonly teamEntityIds: Record<Team, EntityId[]> = {
    attacker: [],
    defender: [],
  }
  private x = new Float64Array(0)
  private y = new Float64Array(0)
  private dirtyFlags = new Uint8Array(0)
  private dirtyEntityIds = new Int32Array(64)
  private dirtyCount = 0
  private active = false
  private readonly profile = createTargetingRuntimeProfile()

  constructor(private readonly profilingEnabled = false) {}

  begin(world: CombatWorld): void {
    const startedAt = this.now()
    this.clearDirty()
    const entityIds = world.query(TARGETABLE_QUERY)
    this.ensureEntityCapacity(world.captureEntityWatermark())
    this.teamEntityIds.attacker.length = 0
    this.teamEntityIds.defender.length = 0
    for (const entityId of entityIds) {
      const transform = world.stores.transform.require(entityId)
      this.x[entityId] = transform.x
      this.y[entityId] = transform.y
      const team = world.stores.identity.require(entityId).team
      this.teamEntityIds[team].push(entityId)
    }
    this.teamCells.attacker.build(
      this.teamEntityIds.attacker, this.x, this.y,
    )
    this.teamCells.defender.build(
      this.teamEntityIds.defender, this.x, this.y,
    )
    this.active = true
    if (this.profilingEnabled) {
      this.profile.targetingFrameBuildCount++
      this.profile.targetingFrameEntityCount += entityIds.length
      this.profile.targetingFrameBuildMs += performance.now() - startedAt
    }
  }

  end(): void {
    this.active = false
  }

  markDirty(entityId: EntityId): void {
    if (!this.active) return
    this.ensureEntityCapacity(entityId + 1)
    if (this.dirtyFlags[entityId] === 1) return
    if (this.dirtyCount >= this.dirtyEntityIds.length) {
      const grown = new Int32Array(this.dirtyEntityIds.length * 2)
      grown.set(this.dirtyEntityIds)
      this.dirtyEntityIds = grown
    }
    this.dirtyFlags[entityId] = 1
    this.dirtyEntityIds[this.dirtyCount++] = entityId
  }

  collect(
    world: CombatWorld,
    x: number,
    y: number,
    radius: number,
    team: TargetTeam,
  ): TargetingScratch {
    if (!this.active) return this.collectLegacy(world, x, y, radius, team)
    const startedAt = this.now()
    const scratch = this.scratch
    scratch.reset()
    scratch.liveTeamFiltered = team !== 'all'
    let bucketCandidates = 0
    if (team === 'all') {
      bucketCandidates += this.scanBase(
        this.teamCells.attacker, x, y, radius, scratch,
      )
      bucketCandidates += this.scanBase(
        this.teamCells.defender, x, y, radius, scratch,
      )
    } else {
      bucketCandidates = this.scanBase(
        this.teamCells[team], x, y, radius, scratch,
      )
    }
    const dirtyCandidates = this.scanDirty(
      world, team, x, y, radius, scratch,
    )
    if (this.profilingEnabled) {
      this.profile.targetingAcquisitionCount++
      this.profile.targetingBucketCandidateCount += bucketCandidates
      this.profile.targetingCandidateCount += scratch.length
      this.profile.targetingMaxCandidates = Math.max(
        this.profile.targetingMaxCandidates, scratch.length,
      )
      this.profile.targetingDirtyCandidateCount += dirtyCandidates
      this.profile.targetingQueryMs += performance.now() - startedAt
    }
    return scratch
  }

  startSelection(): number {
    return this.now()
  }

  finishSelection(startedAt: number): void {
    if (this.profilingEnabled) {
      this.profile.targetingSelectionMs += performance.now() - startedAt
    }
  }

  getProfile(): TargetingRuntimeProfile {
    return {
      ...this.profile,
      targetingScratchGrowthCount: this.scratch.growthCount,
    }
  }

  private collectLegacy(
    world: CombatWorld,
    x: number,
    y: number,
    radius: number,
    team: TargetTeam,
  ): TargetingScratch {
    const spatial = world.resources.require('entitySpatial')
    const candidates = team === 'all'
      ? spatial.query(world, x, y, radius, 'targeting')
      : spatial.queryTeam(world, x, y, radius, team, 'targeting')
    this.scratch.fill(candidates)
    if (this.profilingEnabled) this.profile.targetingLegacyFallbackCount++
    return this.scratch
  }

  private scanBase(
    cells: TargetingPackedCells,
    x: number,
    y: number,
    radius: number,
    scratch: TargetingScratch,
  ): number {
    const minCellX = Math.floor((x - radius) / TILE_SIZE)
    const maxCellX = Math.floor((x + radius) / TILE_SIZE)
    const minCellY = Math.floor((y - radius) / TILE_SIZE)
    const maxCellY = Math.floor((y + radius) / TILE_SIZE)
    const radiusSq = radius * radius
    let bucketCandidates = 0
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cell = getTargetingCell(cellX, cellY)
        if (cell < 0 ||
            !targetingCellIntersectsCircle(cellX, cellY, x, y, radiusSq)) continue
        for (let index = cells.offsets[cell]; index < cells.offsets[cell + 1]; index++) {
          const entityId = cells.entityIds[index]
          bucketCandidates++
          if (this.dirtyFlags[entityId] === 1) continue
          const dx = this.x[entityId] - x
          const dy = this.y[entityId] - y
          const distanceSq = dx * dx + dy * dy
          if (distanceSq <= radiusSq) scratch.push(entityId, Math.hypot(dx, dy))
        }
      }
    }
    return bucketCandidates
  }

  private scanDirty(
    world: CombatWorld,
    team: TargetTeam,
    x: number,
    y: number,
    radius: number,
    scratch: TargetingScratch,
  ): number {
    const radiusSq = radius * radius
    let dirtyCandidates = 0
    for (let index = 0; index < this.dirtyCount; index++) {
      const entityId = this.dirtyEntityIds[index]
      const transform = world.stores.transform.get(entityId)
      const vitality = world.stores.vitality.get(entityId)
      const identity = world.stores.identity.get(entityId)
      if (!transform || !vitality || !identity || vitality.isDead ||
          (team !== 'all' && identity.team !== team)) continue
      dirtyCandidates++
      const dx = transform.x - x
      const dy = transform.y - y
      const distanceSq = dx * dx + dy * dy
      if (distanceSq <= radiusSq) scratch.push(entityId, Math.hypot(dx, dy))
    }
    return dirtyCandidates
  }

  private ensureEntityCapacity(required: number): void {
    if (required <= this.x.length) return
    let capacity = Math.max(64, this.x.length)
    while (capacity < required) capacity *= 2
    const nextX = new Float64Array(capacity)
    const nextY = new Float64Array(capacity)
    const nextDirtyFlags = new Uint8Array(capacity)
    nextX.set(this.x)
    nextY.set(this.y)
    nextDirtyFlags.set(this.dirtyFlags)
    this.x = nextX
    this.y = nextY
    this.dirtyFlags = nextDirtyFlags
  }

  private clearDirty(): void {
    for (let index = 0; index < this.dirtyCount; index++) {
      this.dirtyFlags[this.dirtyEntityIds[index]] = 0
    }
    this.dirtyCount = 0
  }

  private now(): number {
    return this.profilingEnabled ? performance.now() : 0
  }
}
