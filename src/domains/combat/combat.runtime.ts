import type { BattleAction } from './combat.actions'
import type { DeathCause } from './combat.death'
import type { BattleOutcome } from './combat.outcome'
import type { SimHazard, SimUnit } from './combat.sim.types'
import type { FlowFieldMap } from './combat.pathfinding'
import type { SpatialHash } from './spatial-hash'
import type { Obstacle, Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'
import type { TriggerContext } from './combat.triggers'

export type RuntimeDeathHandler = (
  unit: SimUnit,
  sourceUnitId: string | undefined,
  cause: DeathCause,
) => void

export interface RuntimeMovementContext {
  dt: number
  rng: PRNG
  flowField: FlowFieldMap
  obstacles: Obstacle[]
  spatialHash: SpatialHash
}

export interface RuntimeActionContext {
  rng: PRNG
  tick: number
  spatialHash: SpatialHash
}

export interface RuntimeActionResult {
  acted: boolean
  actorSynchronized: boolean
}

export interface CombatRuntime {
  readonly units: SimUnit[]
  readonly hazards: SimHazard[]
  addSquad(row: UnitRow, team: Team, rng: PRNG): void
  flushStructuralCommands(): void
  beginTargetingPhase(spatialHash: SpatialHash): void
  selectTarget(unit: SimUnit): SimUnit | null
  reserveMeleeSlot(unit: SimUnit, target: SimUnit): boolean
  actUnit(unit: SimUnit, target: SimUnit, actions: BattleAction[], context: RuntimeActionContext): RuntimeActionResult
  moveUnit(unit: SimUnit, target: SimUnit, actions: BattleAction[], context: RuntimeMovementContext): void
  completeActorTurn(unit: SimUnit, actions: readonly BattleAction[], actionStart: number, actorSynchronized?: boolean): void
  insertSpatialUnit(unit: SimUnit): void
  snapshotUnits(): SimUnit[]
  getSurvivors(): SimUnit[]
  getTurnOrder(): SimUnit[]
  tickModifiers(unit: SimUnit, dt: number, actions: BattleAction[], onExpire: (unit: SimUnit) => void): void
  runStatusPhase(actions: BattleAction[], onUnitDeath: RuntimeDeathHandler): void
  runHazardPhase(actions: BattleAction[], onUnitDeath: RuntimeDeathHandler, spatialHash: SpatialHash): void
  runPostHazardPhase(triggerContext: TriggerContext): void
  runDepenetration(actions: BattleAction[]): void
  getTerminalOutcome(
    hazards: SimHazard[],
    pendingAttackers: boolean,
    pendingDefenders: boolean,
  ): BattleOutcome | null
}
