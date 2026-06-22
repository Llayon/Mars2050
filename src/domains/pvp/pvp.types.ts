import type { BattleTick } from '@/domains/combat/combat.types'
import type { UnitRow, SimUnit, Obstacle } from '@/domains/combat/combat.types'

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
}

export interface TradeResult {
  success: boolean
  error?: string
  message?: string
}