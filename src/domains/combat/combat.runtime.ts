import type { BattleAction } from './combat.actions'
import type { DeathCause } from './combat.death'
import type { BattleOutcome } from './combat.outcome'
import type { SimHazard, SimUnit } from './combat.sim.types'

export type RuntimeDeathHandler = (
  unit: SimUnit,
  sourceUnitId: string | undefined,
  cause: DeathCause,
) => void

export interface CombatRuntime {
  readonly units: SimUnit[]
  snapshotUnits(): SimUnit[]
  getSurvivors(): SimUnit[]
  getTurnOrder(): SimUnit[]
  tickModifiers(unit: SimUnit, dt: number, actions: BattleAction[], onExpire: (unit: SimUnit) => void): void
  runStatusPhase(actions: BattleAction[], onUnitDeath: RuntimeDeathHandler): void
  getTerminalOutcome(
    hazards: SimHazard[],
    pendingAttackers: boolean,
    pendingDefenders: boolean,
  ): BattleOutcome | null
}
