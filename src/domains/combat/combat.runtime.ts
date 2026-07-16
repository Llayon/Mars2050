import type { BattleAction } from './combat.actions'
import type { DeathCause } from './combat.death'
import type { BattleOutcome } from './combat.outcome'
import type { SimHazard, SimUnit } from './combat.sim.types'
import type { SpatialHash } from './spatial-hash'

export type RuntimeDeathHandler = (
  unit: SimUnit,
  sourceUnitId: string | undefined,
  cause: DeathCause,
) => void

export interface CombatRuntime {
  readonly units: SimUnit[]
  readonly hazards: SimHazard[]
  snapshotUnits(): SimUnit[]
  getSurvivors(): SimUnit[]
  getTurnOrder(): SimUnit[]
  tickModifiers(unit: SimUnit, dt: number, actions: BattleAction[], onExpire: (unit: SimUnit) => void): void
  runStatusPhase(actions: BattleAction[], onUnitDeath: RuntimeDeathHandler): void
  runHazardPhase(actions: BattleAction[], onUnitDeath: RuntimeDeathHandler, spatialHash: SpatialHash): void
  getTerminalOutcome(
    hazards: SimHazard[],
    pendingAttackers: boolean,
    pendingDefenders: boolean,
  ): BattleOutcome | null
}
