import { registerCombatSimulator, simulateCombat } from '@mars2050/combat-core'
import { executeCombatSimulation } from './combat.runner'

// Register the Mars runtime engine with the core facade
registerCombatSimulator(executeCombatSimulation)

export { simulateCombat }
