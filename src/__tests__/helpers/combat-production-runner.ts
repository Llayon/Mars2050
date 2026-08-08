import { simulateBattle as simulateBattleEngine } from '@/domains/combat/combat.engine'
import type { BattleResult, UnitRow } from '@/domains/combat/combat.types'
import type { Obstacle } from '@/domains/combat/combat.sim.types'
import { V9_SIMULATION_REVISION, V9_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import type { BattleSimulationOptions } from '@/domains/combat/combat.metrics'

export type ProductionCombatOptions = Omit<BattleSimulationOptions, 'defenseResolutionMode'>

/**
 * Runs the authoritative production combat configuration used by certification tests.
 *
 * @param attackers Attacking unit rows.
 * @param defenders Defending unit rows.
 * @param seed Deterministic simulation seed.
 * @param obstacles Obstacle contract for the battle.
 * @param attackerGlobals Attacker global upgrades.
 * @param defenderGlobals Defender global upgrades.
 * @param options Production simulation options without a defense mode override.
 * @returns A certified V9 battle result.
 */
export function runCertifiedProductionCombat(
  attackers: UnitRow[],
  defenders: UnitRow[],
  seed: number,
  obstacles: Obstacle[] = [],
  attackerGlobals: string[] = [],
  defenderGlobals: string[] = [],
  options: ProductionCombatOptions = {},
): BattleResult {
  if (Object.prototype.hasOwnProperty.call(options, 'defenseResolutionMode')) {
    throw new Error('Certified production combat does not accept defenseResolutionMode overrides')
  }

  const result = simulateBattleEngine(
    attackers,
    defenders,
    seed,
    obstacles,
    attackerGlobals,
    defenderGlobals,
    options,
  )

  if (result.simulationVersion !== V9_SIMULATION_VERSION) {
    throw new Error(`Expected V9 simulation version ${V9_SIMULATION_VERSION}, received ${result.simulationVersion}`)
  }
  if (result.simulationRevision !== V9_SIMULATION_REVISION) {
    throw new Error(`Expected V9 simulation revision ${V9_SIMULATION_REVISION}, received ${result.simulationRevision}`)
  }

  return result
}
