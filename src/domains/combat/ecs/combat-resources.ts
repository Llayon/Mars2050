import type { BattleAction } from '../combat.actions'
import type { CombatMetricsCollector } from '../combat.metrics'
import type { Obstacle } from '../combat.sim.types'
import type { GlobalUpgradeConfig } from '../combat.upgrades'
import type { PRNG } from '../combat.utils'
import type { Team } from '../combat.sim.types'
import type { FlowFieldMap } from '../combat.pathfinding'
import type { TimeoutPolicy } from '../combat.result'
import type { EntitySpatialIndex } from './entity-spatial-index'

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
