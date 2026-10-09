import { BattleInputSpec, CombatRunResult, combatRunResultSchema } from '../contracts/index.js'
import { executeCombatSimulation } from '../combat.runner.js'
import { validateBattleInput } from '../combat.input-validator.js'

/**
 * Simulates a battle deterministically using the combat simulation engine.
 * Validates inputs against BattleInput Zod contract and referential integrity (R3a)
 * before any world creation or RNG consumption, and validates output against CombatRunResult.
 */
export function simulateCombat(input: BattleInputSpec): CombatRunResult {
  const validatedInput = validateBattleInput(input)
  const result = executeCombatSimulation(validatedInput)
  return combatRunResultSchema.parse(result)
}

