import type { BattleAction } from './combat.actions.js'
import type { BattleOutcome } from './combat.outcome.js'
import type { SimUnit } from './combat.sim.types.js'
import type { FlowFieldMap } from './combat.pathfinding.js'
import type { Obstacle, Team } from './combat.sim.types.js'
import type { UnitRow } from './combat.types.js'
import type { PRNG } from './combat.utils.js'
import type { CombatPhaseId, CombatPhaseStage, RuntimePhaseContext } from './combat.phase.js'

export interface RuntimeMovementContext {
  dt: number
  rng: PRNG
  flowField: FlowFieldMap
  obstacles: Obstacle[]
}

export interface RuntimeActionContext {
  rng: PRNG
  tick: number
  allowDeadActorAction?: boolean
}

export interface RuntimeActionResult {
  acted: boolean
}

export interface CombatRuntime {
  addSquad(row: UnitRow, team: Team, rng: PRNG): void
  flushStructuralCommands(): void
  snapshotUnits(): SimUnit[]
  getSurvivors(): SimUnit[]
  runPhase(id: CombatPhaseId, context: RuntimePhaseContext): void
  runStage(stage: CombatPhaseStage, context: RuntimePhaseContext): void
  getTerminalOutcome(): BattleOutcome | null
}
