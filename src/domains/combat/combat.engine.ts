import type { UnitRow, BattleResult } from './combat.types'
import type { Obstacle } from './combat.sim.types'
import type { BattleSimulationOptions } from './combat.metrics'
import { translateMarsBattleInput } from './combat.input-translator'
import { mapCombatRunResultToBattleResult } from './combat.compat-mapper'
import { simulateCombat } from './combat.facade'

/**
 * Backward-compatible simulation entrypoint for Mars callers.
 * Translates input rows/globals into clean BattleInput, delegates to
 * simulateCombat facade, and maps the result back to BattleResult.
 */
export function simulateBattle(
  attackerUnits: UnitRow[],
  defenderUnits: UnitRow[],
  providedSeed?: number,
  providedObstacles?: Obstacle[],
  attackerGlobals: string[] = [],
  defenderGlobals: string[] = [],
  options: BattleSimulationOptions = {},
): BattleResult {
  const input = translateMarsBattleInput(
    attackerUnits,
    defenderUnits,
    providedSeed,
    providedObstacles,
    attackerGlobals,
    defenderGlobals,
    options,
  )

  const combatResult = simulateCombat(input)
  return mapCombatRunResultToBattleResult(combatResult, input.arena.obstacles)
}

