import { UNIT_TYPES } from './combat.config'
import { getUnitRank } from './combat.rank-scaling'
import { getFormationSpacing } from './combat.runtime-primitives'
import type { Team } from './combat.sim.types'
import type { UnitBuildSpec } from './combat.unit-build.types'
import { compileUnit } from './combat.unit-compiler'
import type { UnitRow } from './combat.types'
import { FIELD_HEIGHT, FIELD_WIDTH, type PRNG } from './combat.utils'
import type { UnitEntityBundle } from './ecs/unit-entity-bundle'
import { getFormationOffset } from '@mars2050/combat-core/math'

export function compileSquadBundles(
  row: UnitRow,
  team: Team,
  rng: PRNG,
  catalog?: import('./combat.catalog.types').CombatCatalog,
  arena?: { width: number; height: number },
): UnitEntityBundle[] {
  return createSquadBuildSpecs(row, team, rng, catalog, arena).flatMap(spec => {
    const compiled = compileUnit(spec)
    return compiled ? [compiled] : []
  })
}

export function createSquadBuildSpecs(
  row: UnitRow,
  team: Team,
  rng: PRNG,
  catalog?: import('./combat.catalog.types').CombatCatalog,
  arena?: { width: number; height: number },
): UnitBuildSpec[] {
  const unitCatalog = catalog?.unitTypes ?? UNIT_TYPES
  const config = unitCatalog[row.unit_type]
  if (!config) return []
  const squadSize = config.squadSize || 1
  const spacing = getFormationSpacing(
    config.squadSpacing || 20,
    config.baseStats,
  )
  const rowSize = Math.ceil(Math.sqrt(squadSize))
  const arenaWidth = arena?.width ?? FIELD_WIDTH
  const arenaHeight = arena?.height ?? FIELD_HEIGHT
  const rawX = row.grid_x != null
    ? row.grid_x
    : String(Math.floor(rng.next() * arenaWidth))
  const rawY = row.grid_y != null
    ? row.grid_y
    : String(Math.floor(rng.next() * 320) + (team === 'attacker' ? arenaHeight - 320 : 0))
  const centerX = Number(rawX)
  const centerY = Number(rawY)
  const squadId = squadSize > 1 ? `${row.id}_squad` : undefined
  const rank = getUnitRank(row)
  return Array.from({ length: squadSize }, (_, index) => {
    const offset = getFormationOffset(
      index,
      squadSize,
      rowSize,
      spacing,
      config.formation || 'grid',
      team,
    )
    const angle = team === 'attacker' ? Math.PI / 2 : -Math.PI / 2
    return {
      definitionId: row.unit_type,
      identity: {
        id: squadSize > 1 ? `${row.id}_${index}` : row.id!,
        team,
        squadId,
      },
      loadout: {
        rank,
        upgradeIds: [...(row.upgrade_path ?? [])],
      },
      placement: {
        x: centerX + offset.x,
        y: centerY + offset.y,
        angle,
        offsetX: offset.x,
        offsetY: offset.y,
      },
      overrides: { currentHp: row.hp_current ?? undefined },
      catalog,
    }
  })
}
export { getFormationOffset } from '@mars2050/combat-core/math'
