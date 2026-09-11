import { BattleInput, BattleInputSpec, CombatRunResult, battleInputSchema, combatRunResultSchema } from '../contracts/index.js'

export type CombatSimulatorHandler = (input: BattleInput) => CombatRunResult

let activeSimulator: CombatSimulatorHandler | null = null

/**
 * Registers the active combat simulation engine.
 * Both Mars and the extracted combat-core runtime provide this engine.
 */
export function registerCombatSimulator(handler: CombatSimulatorHandler): void {
  activeSimulator = handler
}

/**
 * Simulates a battle deterministically using the registered simulation engine.
 * Validates inputs against BattleInput Zod contract and output against CombatRunResult.
 */
export function simulateCombat(input: BattleInputSpec): CombatRunResult {
  const parsedInput = battleInputSchema.parse(input)
  if (!activeSimulator) {
    throw new Error('Combat simulator engine is not registered. Ensure combat-core runtime is loaded.')
  }
  const result = activeSimulator(parsedInput)
  return combatRunResultSchema.parse(result)
}
