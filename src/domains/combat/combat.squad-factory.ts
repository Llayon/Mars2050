import { createSquadBuildSpecs } from './combat.squad-compiler'
import type { SimUnit, Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import type { PRNG } from './combat.utils'
import { compileUnitSnapshot } from './combat.unit-compiler'

export function createRuntimeSquad(row: UnitRow, team: Team, rng: PRNG): SimUnit[] {
  return createSquadBuildSpecs(row, team, rng)
    .map(compileUnitSnapshot)
    .filter((unit): unit is SimUnit => unit !== null)
}
