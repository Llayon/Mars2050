import type { CombatRunResult, CombatSnapshotUnit } from '@mars2050/combat-core/contracts'
import { deserializeCombatAction, deserializeCombatUnitSnapshot } from '@mars2050/combat-core/replay'
import type { BattleResult, BattleTick } from './combat.types'
import type { Obstacle } from './combat.sim.types'
import type { CombatMetrics } from './combat.metrics'
import type { SpatialQueryProfile } from './combat.spatial-profile'

/**
 * Maps a core CombatRunResult back to Mars-compatible BattleResult via explicit DTO deserialization.
 */
export function mapCombatRunResultToBattleResult(
  result: CombatRunResult,
  obstacles: Obstacle[],
): BattleResult {
  const profileMetrics = (result.metrics ?? result.profile?.metrics) as CombatMetrics | undefined
  const profileSpatial = (result.profile?.spatial ?? result.profile) as SpatialQueryProfile | undefined

  const mappedLogs: BattleTick[] = result.logs.map(tick => ({
    tick: tick.tick,
    actions: tick.actions.map(action => deserializeCombatAction(action)),
  }))

  const mappedInitialState: CombatSnapshotUnit[] = result.initialState.map(unit =>
    deserializeCombatUnitSnapshot(unit),
  )

  const mappedSurvivors: CombatSnapshotUnit[] = result.survivors.map(unit =>
    deserializeCombatUnitSnapshot(unit),
  )

  return {
    winner: result.winner,
    logs: mappedLogs,
    seed: result.seed,
    initialState: mappedInitialState,
    survivors: mappedSurvivors,
    obstacles,
    metrics: profileMetrics,
    terminationReason: result.terminationReason as BattleResult['terminationReason'],
    elapsedTicks: result.elapsedTicks,
    simulationVersion: result.engineVersion,
    simulationRevision: result.engineRevision,
    profile: profileSpatial,
    metadata: result.metadata,
  }
}
