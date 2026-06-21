import type { BattleTick } from '@/domains/combat/combat.types'
import type { UnitRow } from '@/domains/combat/combat.types'

export interface AttackResult {
  success: boolean
  error?: string
  message?: string
  stolen?: Record<string, number>
  logs?: BattleTick[]
  attackerUnits?: UnitRow[]
  defenderUnits?: UnitRow[]
}

export interface TradeResult {
  success: boolean
  error?: string
  message?: string
}