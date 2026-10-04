import type { CombatRunResult } from '@mars2050/combat-core/contracts'
import { deserializeCombatAction, deserializeCombatUnitSnapshot } from '@mars2050/combat-core/replay'
import type { BattleResult, BattleTick } from './combat.types'
import type { Obstacle, SimUnit } from './combat.sim.types'
import type { CombatMetrics } from './combat.metrics'
import type { SpatialQueryProfile } from './combat.spatial-profile'

/**
 * Maps a core CombatRunResult back to Mars-compatible BattleResult via explicit DTO deserialization.
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
  const profileMetrics = result.profile?.metrics as CombatMetrics | undefined
  const profileSpatial = result.profile?.spatial as SpatialQueryProfile | undefined

  const mappedLogs: BattleTick[] = result.logs.map(tick => ({
    tick: tick.tick,
    actions: tick.actions.map(action => deserializeCombatAction(action)),
  }))

  const mappedInitialState = result.initialState.map(unit =>
    deserializeCombatUnitSnapshot(unit) as unknown as SimUnit,
  )

  const mappedSurvivors = result.survivors.map(unit =>
    deserializeCombatUnitSnapshot(unit) as unknown as SimUnit,
  )

  return {
    winner: result.winner,
    logs: options?.simLogs ?? mappedLogs,
    seed: result.seed,
    initialState: options?.simInitialState ?? mappedInitialState,
    survivors: options?.simSurvivors ?? mappedSurvivors,
    obstacles,
    metrics: options?.metrics ?? profileMetrics,
    terminationReason: result.terminationReason as BattleResult['terminationReason'],
    elapsedTicks: result.elapsedTicks,
    simulationVersion: result.engineVersion,
    simulationRevision: result.engineRevision,
    profile: options?.profile ?? profileSpatial,
  }
}
