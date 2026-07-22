import type { BattleAction } from './combat.actions'
import type { BattleOutcome } from './combat.outcome'
import type { SimUnit } from './combat.sim.types'
import type { FlowFieldMap } from './combat.pathfinding'
import type { Obstacle, Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'
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
