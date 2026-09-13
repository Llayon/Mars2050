import { createSquadBuildSpecs } from './combat.squad-compiler.js'
import type { SimUnit, Team } from './combat.sim.types.js'
import type { UnitRow } from './combat.types.js'
import type { PRNG } from './combat.utils.js'
import { compileUnitSnapshot } from './combat.unit-compiler.js'

export function createRuntimeSquad(
  row: UnitRow,
  team: Team,
  rng: PRNG,
  catalog?: import('./combat.catalog.types.js').CombatCatalog,
): SimUnit[] {
  return createSquadBuildSpecs(row, team, rng, catalog)
    .map(compileUnitSnapshot)
    .filter((unit): unit is SimUnit => unit !== null)
}
