import { createSquadBuildSpecs } from './combat.squad-compiler'
import type { SimUnit, Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'
import { compileUnitSnapshot } from './combat.unit-compiler'

export function createRuntimeSquad(
  row: UnitRow,
  team: Team,
  rng: PRNG,
  catalog?: import('./combat.catalog.types').CombatCatalog,
): SimUnit[] {
  return createSquadBuildSpecs(row, team, rng, catalog)
    .map(compileUnitSnapshot)
    .filter((unit): unit is SimUnit => unit !== null)
}
