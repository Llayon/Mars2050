import type { BattleAction } from './combat.actions'
import type { BattleOutcome } from './combat.outcome'
import type { SimUnit } from './combat.sim.types'
import type { FlowFieldMap } from './combat.pathfinding'
import type { Obstacle, Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'
import type { EntityId } from './ecs/entity'
import type { CombatPhaseId, CombatPhaseStage, RuntimePhaseContext } from './combat.phase'

export interface RuntimeMovementContext {
  dt: number
  rng: PRNG
  flowField: FlowFieldMap
  obstacles: Obstacle[]
}

export interface RuntimeActionContext {
  rng: PRNG
  tick: number
}

export interface RuntimeActionResult {
  acted: boolean
  actorSynchronized: boolean
}

export interface CombatRuntime {
  addSquad(row: UnitRow, team: Team, rng: PRNG): void
  flushStructuralCommands(): void
  beginTargetingPhase(): void
  selectTarget(entityId: EntityId): EntityId | null
  reserveMeleeSlot(entityId: EntityId, targetId: EntityId): boolean
  processSpawner(entityId: EntityId, targetId: EntityId, actions: BattleAction[], context: RuntimeActionContext): void
  actUnit(entityId: EntityId, targetId: EntityId, actions: BattleAction[], context: RuntimeActionContext): RuntimeActionResult
  moveUnit(entityId: EntityId, targetId: EntityId, actions: BattleAction[], context: RuntimeMovementContext): void
  insertSpatialUnit(entityId: EntityId): void
  isDead(entityId: EntityId): boolean
  canActOnTarget(entityId: EntityId, targetId: EntityId): boolean
  snapshotUnits(): SimUnit[]
  getSurvivors(): SimUnit[]
  getTurnOrder(): EntityId[]
  tickModifiers(entityId: EntityId, dt: number, actions: BattleAction[], rng: PRNG): void
  runPhase(id: CombatPhaseId, context: RuntimePhaseContext): void
  runStage(stage: CombatPhaseStage, context: RuntimePhaseContext): void
  getTerminalOutcome(): BattleOutcome | null
}
