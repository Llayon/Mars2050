import { UNIT_TYPES } from './combat.config'
import { getUnitRank } from './combat.rank-scaling'
import { getFormationSpacing } from './combat.runtime-primitives'
import type { Team } from './combat.sim.types'
import type { UnitBuildSpec } from './combat.unit-build.types'
import { compileUnit } from './combat.unit-compiler'
import type { UnitRow } from './combat.types'
import { FIELD_HEIGHT, FIELD_WIDTH, type PRNG } from './combat.utils'
import type { UnitEntityBundle } from './ecs/unit-entity-bundle'

export function compileSquadBundles(
  row: UnitRow,
  team: Team,
  rng: PRNG,
): UnitEntityBundle[] {
  return createSquadBuildSpecs(row, team, rng).flatMap(spec => {
    const compiled = compileUnit(spec)
    return compiled ? [compiled] : []
  })
}

export function createSquadBuildSpecs(
  row: UnitRow,
  team: Team,
  rng: PRNG,
): UnitBuildSpec[] {
  const config = UNIT_TYPES[row.unit_type]
  if (!config) return []
  const squadSize = config.squadSize || 1
  const spacing = getFormationSpacing(
    config.squadSpacing || 20,
    config.baseStats,
  )
  const rowSize = Math.ceil(Math.sqrt(squadSize))
  if (row.grid_x == null) {
    row.grid_x = String(Math.floor(rng.next() * FIELD_WIDTH))
  }
  if (row.grid_y == null) {
    row.grid_y = String(Math.floor(rng.next() * 320) +
      (team === 'attacker' ? FIELD_HEIGHT - 320 : 0))
  }
  const centerX = Number(row.grid_x)
  const centerY = Number(row.grid_y)
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
    }
  })
}

function getFormationOffset(
  index: number,
  squadSize: number,
  rowSize: number,
  spacing: number,
  formation: string,
  team: Team,
): { x: number; y: number } {
  let x = 0, y = 0
  if (formation === 'line') {
    x = (index - (squadSize - 1) / 2) * spacing
  } else if (formation === 'wedge') {
    if (index === 0) y = spacing
    else {
      const rank = Math.ceil(index / 2)
      x = (index % 2 === 0 ? 1 : -1) * rank * spacing
      y = spacing - rank * spacing
    }
  } else {
    const row = Math.floor(index / rowSize)
    const column = index % rowSize
    x = (column - (rowSize - 1) / 2) * spacing
    y = (row - (Math.ceil(squadSize / rowSize) - 1) / 2) * spacing
  }
  return { x, y: y * (team === 'attacker' ? 1 : -1) }
}
