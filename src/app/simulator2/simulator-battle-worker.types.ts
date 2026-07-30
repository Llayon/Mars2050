import type { BattleResult } from '@/domains/combat/combat.actions'
import type { Obstacle, UnitRow } from '@/domains/combat/combat.types'

export interface SimulatorBattleWorkerRequest {
  attackerUnits: UnitRow[]
  defenderUnits: UnitRow[]
  seed: number
  obstacles: Obstacle[]
  attackerGlobals: string[]
  defenderGlobals: string[]
}

export type SimulatorBattleWorkerResponse =
  | { ok: true; result: BattleResult }
  | { ok: false; error: string }
