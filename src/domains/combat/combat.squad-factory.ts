import { createRuntimeSquad as coreCreateRuntimeSquad } from '@mars2050/combat-core/combat.squad-factory'
import type { SimUnit, Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'
import { getUnitRank } from './combat.rank-scaling'

export * from '@mars2050/combat-core/combat.squad-factory'

/**
 * Creates runtime squad units for Mars, normalizing legacy row attributes.
 *
 * @param row Unit row from Mars database or scenario.
 * @param team Team assignment for the squad.
 * @param rng Pseudo-random number generator for placement and formation.
 * @param catalog Optional combat catalog override.
 * @returns Array of compiled simulation units.
 */
export function createRuntimeSquad(
  row: UnitRow,
  team: Team,
  rng: PRNG,
  catalog?: import('@mars2050/combat-core/combat.catalog.types').CombatCatalog,
): SimUnit[] {
  const normalizedRow = {
    ...row,
    rank: getUnitRank(row),
  }
  return coreCreateRuntimeSquad(normalizedRow, team, rng, catalog)
}
