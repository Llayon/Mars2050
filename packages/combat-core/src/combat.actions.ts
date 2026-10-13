import type { Obstacle } from './contracts/battle.contracts.js'
import type { CombatSnapshotUnit } from './contracts/replay.types.js'
import type { CombatMetrics } from './contracts/metrics.contracts.js'
import type { TerminationReason } from './combat.result.js'
import type { SpatialQueryProfile } from './combat.spatial-profile.js'
import type { CombatMetadata } from './contracts/identity.contracts.js'
import type { BattleTick } from './contracts/replay.actions.js'

export * from './contracts/replay.actions.js'
export type { CombatSnapshotUnit }

export interface BattleResult {
  winner: 'attacker' | 'defender' | 'draw'
  logs: BattleTick[]
  seed: number
  survivors: CombatSnapshotUnit[]
  initialState: CombatSnapshotUnit[]
  obstacles?: Obstacle[]
  metrics?: CombatMetrics
  terminationReason: TerminationReason
  elapsedTicks: number
  simulationVersion: number
  simulationRevision: string
  profile?: SpatialQueryProfile
  metadata?: CombatMetadata
}
