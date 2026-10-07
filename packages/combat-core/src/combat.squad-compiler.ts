import { getUnitRank } from './combat.rank-scaling.js'
import { getFormationSpacing } from './combat.runtime-primitives.js'
import type { Team } from './combat.sim.types.js'
import type { UnitBuildSpec } from './combat.unit-build.types.js'
import { compileUnit } from './combat.unit-compiler.js'
import type { UnitRow } from './combat.types.js'
import { FIELD_HEIGHT, FIELD_WIDTH, type PRNG } from './combat.utils.js'
import type { UnitEntityBundle } from './ecs/unit-entity-bundle.js'
import { getFormationOffset } from './math/index.js'
import { getDefaultCombatCatalog, type CombatCatalog } from './combat.catalog.types.js'
import { resolveDeploymentBounds } from './combat.deployment-bounds.js'
import type { ArenaDeployment } from './contracts/index.js'

export function compileSquadBundles(
  row: UnitRow,
  team: Team,
  rng: PRNG,
  catalog?: CombatCatalog,
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
  catalog?: CombatCatalog,
  arena?: { width: number; height: number },
): UnitBuildSpec[] {
  const resolvedCatalog = catalog ?? getDefaultCombatCatalog()
  const unitCatalog = resolvedCatalog?.unitTypes ?? {}
  const config = unitCatalog[row.unit_type]
  if (!config) return []
  const squadSize = Math.max(1, Math.floor(config.squadSize ?? 1))
  const spacing = getFormationSpacing(
    config.squadSpacing ?? 20,
    config.baseStats,
  )
  const rowSize = Math.ceil(Math.sqrt(squadSize))
  const arenaWidth = arena?.width ?? FIELD_WIDTH
  const arenaHeight = arena?.height ?? FIELD_HEIGHT
  const bounds = resolveDeploymentBounds(
    { width: arenaWidth, height: arenaHeight, deployment: (arena as { width: number; height: number; deployment?: ArenaDeployment })?.deployment },
    team,
  )
  const zoneWidth = bounds.maxX - bounds.minX
  const zoneHeight = bounds.maxY - bounds.minY
  const rawX = row.grid_x != null
    ? row.grid_x
    : String(Math.floor(rng.next() * zoneWidth) + bounds.minX)
  const rawY = row.grid_y != null
    ? row.grid_y
    : String(Math.floor(rng.next() * zoneHeight) + bounds.minY)
  const centerX = Number(rawX)
  const centerY = Number(rawY)
  const squadId = squadSize > 1 ? `${row.id}_squad` : undefined
  const rank = getUnitRank({ rank: row.rank })
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
      catalog: resolvedCatalog,
      preparedStats: (row as { preparedStats?: import('./contracts/prepared.contracts.js').PreparedStats }).preparedStats,
    }
  })
}
export { getFormationOffset } from './math/index.js'
