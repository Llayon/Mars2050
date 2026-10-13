import { simulateCombat, type CombatCatalog } from '@mars2050/combat-core'
import { translateMarsBattleInput } from './combat.input-translator'
import { MARS_CATALOG } from './combat.catalog'
import type { SimUnit, Team, UnitRow } from './combat.types'
import { FIELD_WIDTH, FIELD_HEIGHT, type PRNG } from './combat.utils'

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
  const zoneWidth = FIELD_WIDTH
  const zoneHeight = 300
  const minX = 0
  const minY = team === 'attacker' ? FIELD_HEIGHT - zoneHeight : 0
  const grid_x = row.grid_x != null ? String(row.grid_x) : String(Math.floor(rng.next() * zoneWidth) + minX)
  const grid_y = row.grid_y != null ? String(row.grid_y) : String(Math.floor(rng.next() * zoneHeight) + minY)
  const rowWithPlacement: UnitRow = {
    ...row,
    grid_x,
    grid_y,
  }
  const seed = (rng as unknown as { seed?: number }).seed ?? 42
  const attackers = team === 'attacker' ? [rowWithPlacement] : []
  const defenders = team === 'defender' ? [rowWithPlacement] : []
  const battleInput = translateMarsBattleInput(
    attackers,
    defenders,
    seed,
    [],
    [],
    [],
    { maxTicks: 1, catalog: activeCatalog },
  )
  const result = simulateCombat(battleInput)
  return result.initialState.filter(u => u.team === team) as SimUnit[]
}

