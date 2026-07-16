import type { BattleAction } from './combat.actions'
import type { DeathCause } from './combat.death'
import type { BattleOutcome } from './combat.outcome'
import type { SimHazard, SimUnit } from './combat.sim.types'
import type { SpatialHash } from './spatial-hash'
import type { Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'

export type RuntimeDeathHandler = (
  unit: SimUnit,
  sourceUnitId: string | undefined,
  cause: DeathCause,
) => void

export interface CombatRuntime {
  readonly units: SimUnit[]
  readonly hazards: SimHazard[]
  addSquad(row: UnitRow, team: Team, rng: PRNG): void
  flushStructuralCommands(): void
  beginTargetingPhase(spatialHash: SpatialHash): void
  selectTarget(unit: SimUnit): SimUnit | null
  reserveMeleeSlot(unit: SimUnit, target: SimUnit): boolean
  completeActorTurn(unit: SimUnit, actions: readonly BattleAction[], actionStart: number): void
  insertSpatialUnit(unit: SimUnit): void
  updateSpatialUnit(unit: SimUnit): void
  snapshotUnits(): SimUnit[]
  getSurvivors(): SimUnit[]
  getTurnOrder(): SimUnit[]
  tickModifiers(unit: SimUnit, dt: number, actions: BattleAction[], onExpire: (unit: SimUnit) => void): void
  runStatusPhase(actions: BattleAction[], onUnitDeath: RuntimeDeathHandler): void
  runHazardPhase(actions: BattleAction[], onUnitDeath: RuntimeDeathHandler, spatialHash: SpatialHash): void
  runDepenetration(actions: BattleAction[]): void
  getTerminalOutcome(
    hazards: SimHazard[],
    pendingAttackers: boolean,
    pendingDefenders: boolean,
  ): BattleOutcome | null
}
