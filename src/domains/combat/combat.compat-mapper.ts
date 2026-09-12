import type { CombatRunResult } from '@mars2050/combat-core/contracts'
import type { BattleResult, BattleTick } from './combat.types'
import type { Obstacle, SimUnit } from './combat.sim.types'
import type { CombatMetrics } from './combat.metrics'
import type { SpatialQueryProfile } from './combat.spatial-profile'


/**
 * Maps a core CombatRunResult back to Mars-compatible BattleResult.
 */
export function mapCombatRunResultToBattleResult(
  result: CombatRunResult,
  obstacles: Obstacle[],
  options?: {
    simInitialState?: SimUnit[]
    simSurvivors?: SimUnit[]
    simLogs?: BattleTick[]
    metrics?: CombatMetrics
    profile?: SpatialQueryProfile
  },
): BattleResult {
  const compat = result.profile?.__marsCompat as {
    simInitialState?: SimUnit[]
    simSurvivors?: SimUnit[]
    simLogs?: BattleTick[]
    metrics?: CombatMetrics
    spatialProfile?: SpatialQueryProfile
  } | undefined
  return {
    winner: result.winner,
    logs: options?.simLogs ?? compat?.simLogs ?? (result.logs as unknown as BattleTick[]),
    seed: result.seed,
    initialState: options?.simInitialState ?? compat?.simInitialState ?? (result.initialState as unknown as SimUnit[]),
    survivors: options?.simSurvivors ?? compat?.simSurvivors ?? (result.survivors as unknown as SimUnit[]),
    obstacles,
    metrics: options?.metrics ?? compat?.metrics,
    terminationReason: result.terminationReason as BattleResult['terminationReason'],
    elapsedTicks: result.elapsedTicks,
    simulationVersion: result.engineVersion,
    simulationRevision: result.engineRevision,
    profile: options?.profile ?? compat?.spatialProfile,
  }
}
