import type { BattleTick } from '@/domains/combat/combat.types'
import type { UnitRow, SimUnit, Obstacle } from '@/domains/combat/combat.types'
import type { CombatMetrics } from '@/domains/combat/combat.metrics'

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
  cooldownRemaining?: number
}

export interface TradeResult {
  success: boolean
  error?: string
  message?: string
}
