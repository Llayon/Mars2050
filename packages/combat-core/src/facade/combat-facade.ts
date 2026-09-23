import { BattleInput, BattleInputSpec, CombatRunResult, combatRunResultSchema } from '../contracts/index.js'
import { executeCombatSimulation } from '../combat.runner.js'
import { validateBattleInput } from '../combat.input-validator.js'

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
 * Validates inputs against BattleInput Zod contract and referential integrity (R3a)
 * before any world creation or RNG consumption, and validates output against CombatRunResult.
 */
export function simulateCombat(input: BattleInputSpec): CombatRunResult {
  const validatedInput = validateBattleInput(input)
  const result = activeSimulator(validatedInput)
  return combatRunResultSchema.parse(result)
}
