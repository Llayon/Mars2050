import {
  createSquadBuildSpecs,
  type CombatCatalog,
} from '@mars2050/combat-core'
import { MARS_CATALOG } from './combat.catalog'
import { compileUnitSnapshot } from './combat.unit-compiler'
import type { SimUnit, Team, UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'

/**
 * Creates a runtime squad from row and team, defaulting to Mars default catalog.
 *
 * @param row The unit row.
 * @param team The team assignment.
 * @param rng PRNG generator.
 * @param catalog Optional combat catalog override.
 * @returns Array of compiled SimUnits.
 */
export function createRuntimeSquad(
  row: UnitRow,
  team: Team,
  rng: PRNG,
  catalog?: CombatCatalog,
): SimUnit[] {
  const activeCatalog = catalog ?? MARS_CATALOG
  return createSquadBuildSpecs(row, team, rng, activeCatalog)
    .map(spec => compileUnitSnapshot({ ...spec, catalog: activeCatalog }))
    .filter((unit): unit is SimUnit => unit !== null)
}
