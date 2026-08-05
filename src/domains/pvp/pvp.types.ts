import type { BattleTick } from '@/domains/combat/combat.types'
import type { UnitRow, SimUnit, Obstacle } from '@/domains/combat/combat.types'
import type { CombatMetrics } from '@/domains/combat/combat.metrics'
import type { TerminationReason } from '@/domains/combat/combat.result'

export interface AttackResult {
  success: boolean
  error?: string
  message?: string
  stolen?: Record<string, number>
  logs?: BattleTick[]
  attackerUnits?: UnitRow[]
  defenderUnits?: UnitRow[]
  initialState?: SimUnit[]
  obstacles?: Obstacle[]
  battleId?: string
  seed?: number
  metrics?: CombatMetrics
  simulationVersion?: number
  simulationRevision?: string
  terminationReason?: TerminationReason
  elapsedTicks?: number
  cooldownRemaining?: number
}

export interface TradeResult {
  success: boolean
  error?: string
  message?: string
}

export type ReplayCompatibilityStatus = 'current' | 'legacy_approximate' | 'unsupported'
export type ReplayCompatibilityReason = 'older_engine' | 'newer_engine' | 'invalid_version' | 'engine_revision_mismatch'

export interface ReplayCompatibility {
  snapshotVersion: number
  currentVersion: number
  status: ReplayCompatibilityStatus
  canPlay: boolean
  visuallyApproximate: boolean
  reason?: ReplayCompatibilityReason
}

export interface StoredBattleReplay {
  initialState: SimUnit[]
  logs: BattleTick[]
  simulationVersion: number
  terminationReason?: TerminationReason
  elapsedTicks?: number
  compatibility: ReplayCompatibility
}
