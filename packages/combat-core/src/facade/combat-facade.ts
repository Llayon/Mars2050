import { BattleInput, BattleInputSpec, CombatRunResult, battleInputSchema, combatRunResultSchema } from '../contracts/index.js'
import { executeCombatSimulation } from '../combat.runner.js'

export type CombatSimulatorHandler = (input: BattleInput) => CombatRunResult

let activeSimulator: CombatSimulatorHandler = executeCombatSimulation

/**
 * Registers the active combat simulation engine.
 * Defaults to the built-in deterministic ECS simulation engine.
 */
export function registerCombatSimulator(handler: CombatSimulatorHandler): void {
  activeSimulator = handler
}

/**
 * Simulates a battle deterministically using the combat simulation engine.
 * Validates inputs against BattleInput Zod contract and output against CombatRunResult.
 */
export function simulateCombat(input: BattleInputSpec): CombatRunResult {
  const parsedInput = battleInputSchema.parse(input)
  const result = activeSimulator(parsedInput)
  return combatRunResultSchema.parse(result)
}
