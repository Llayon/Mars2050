import type { BattleAction } from '../combat.actions'
import type { CombatMetricsCollector } from '../combat.metrics'
import type { Obstacle } from '../combat.sim.types'
import type { GlobalUpgradeConfig } from '../combat.upgrades'
import type { PRNG } from '../combat.utils'
import type { Team } from '../combat.sim.types'
import type { FlowFieldMap } from '../combat.pathfinding'
import type { TimeoutPolicy } from '../combat.result'
import type { CombatTag } from '../combat.primitives'
import type { EntitySpatialIndex } from './entity-spatial-index'
import type { MovementRequest } from './movement-batch.types'
import type { EntityId } from './entity'
import type { TargetingRuntime } from './targeting-runtime'
import type { DesignationIndex } from './designation-index'
import type { EcsActionGroupLedger } from '../combat.action-intent'
import type { PendingImpactQueue } from './pending-impacts'
import type { AttackTimelineState } from './pending-impacts'
import type { DefenseResolutionMode } from './defense-batch'

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
  globals: { team: Team; upg: GlobalUpgradeConfig }[]
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
