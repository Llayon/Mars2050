import type { BattleAction } from '../combat.actions.js'
import type { CombatMetricsCollector } from '../combat.metrics.js'
import type { Obstacle } from '../combat.sim.types.js'
import type { ActiveGlobalEffect } from '../combat.primitives.js'
import type { PRNG } from '../combat.utils.js'
import type { FlowFieldMap } from '../combat.pathfinding.js'
import type { TimeoutPolicy } from '../combat.result.js'
import type { CombatTag } from '../combat.primitives.js'
import type { EntitySpatialIndex } from './entity-spatial-index.js'
import type { MovementRequest } from './movement-batch.types.js'
import type { EntityId } from './entity.js'
import type { TargetingRuntime } from './targeting-runtime.js'
import type { DesignationIndex } from './designation-index.js'
import type { EcsActionGroupLedger } from '../combat.action-intent.js'
import type { ResolutionGroupKey } from '../combat.action-intent.js'
import type { DamageAttribution, DamageSourceContext } from './damage-source.js'
import type { PendingImpactQueue } from './pending-impacts.js'
import type { AttackTimelineState } from './pending-impacts.js'
import type { DefenseResolutionMode } from './defense-batch.js'
import type { TriggerPayload } from '../combat.sim.types.js'
import type { DamageOrderKey } from './defense-batch.js'
import type { ArenaSpec } from '../contracts/index.js'
import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE } from '../combat.utils.js'

export interface V9FollowUpJob {
  ownerExternalId: string
  targetExternalId: string | undefined
  eventTargetExternalId: string
  payload: TriggerPayload
  actions: BattleAction[]
  parentGroupKey?: ResolutionGroupKey
  followUpOrdinal: number
  order: DamageOrderKey
  attribution?: DamageAttribution
  capturedSource?: DamageSourceContext
  chainPath: readonly string[]
}

export interface CombatClockResource {
  tick: number
  dt: number
  maxTicks: number
  timeoutPolicy: TimeoutPolicy
}

export interface CombatResourceMap {
  clock: CombatClockResource
  rng: PRNG
  actions: BattleAction[]
  obstacles: Obstacle[]
  flowField: FlowFieldMap
  entitySpatial: EntitySpatialIndex
  globals: ActiveGlobalEffect[]
  metrics: CombatMetricsCollector | undefined
  movementRequests: MovementRequest[]
  combatTagCache: Map<EntityId, { signature: number; tags: CombatTag[] }>
  dirtySpatialEntities: Set<EntityId>
  targetingRuntime: TargetingRuntime
  designationIndex: DesignationIndex
  actionGroup: EcsActionGroupLedger | undefined
  pendingImpacts: PendingImpactQueue
  temporalAttacks: Map<EntityId, AttackTimelineState>
  defenseResolutionMode: DefenseResolutionMode
  v9FollowUps: V9FollowUpJob[]
  v9FollowUpChainPath: readonly string[] | undefined
  statusDamageAttribution: Map<string, DamageAttribution>
  catalog?: import('../combat.catalog.types.js').CombatCatalog
  arena?: ArenaSpec
}

export class CombatResourceStore {
  private readonly values = new Map<keyof CombatResourceMap, unknown>()

  set<Name extends keyof CombatResourceMap>(name: Name, value: CombatResourceMap[Name]): void {
    this.values.set(name, value)
  }

  get<Name extends keyof CombatResourceMap>(name: Name): CombatResourceMap[Name] | undefined {
    return this.values.get(name) as CombatResourceMap[Name] | undefined
  }

  require<Name extends keyof CombatResourceMap>(name: Name): CombatResourceMap[Name] {
    if (!this.values.has(name)) throw new Error(`Missing combat resource: ${name}`)
    return this.values.get(name) as CombatResourceMap[Name]
  }
}

export function getCombatArena(world: { resources: CombatResourceStore }): ArenaSpec {
  return (
    world.resources.get('arena') ?? {
      width: FIELD_WIDTH,
      height: FIELD_HEIGHT,
      tileSize: TILE_SIZE,
      obstacles: world.resources.get('obstacles') ?? [],
    }
  )
}
