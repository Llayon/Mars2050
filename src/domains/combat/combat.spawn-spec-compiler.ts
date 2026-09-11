import type { UnitDefinition, UnitSpawnSpec } from '@mars2050/combat-core/contracts'
import type { Team } from './combat.sim.types'
import type { UnitBuildSpec } from './combat.unit-build.types'
import { compileUnit } from './combat.unit-compiler'
import type { UnitEntityBundle } from './ecs/unit-entity-bundle'
import type { CombatCatalog } from './combat.catalog.types'
import { FIELD_HEIGHT, FIELD_WIDTH, type PRNG } from './combat.utils'
import { getFormationOffset } from '@mars2050/combat-core/math'

export function compileSpawnSpecBundles(
  spec: UnitSpawnSpec,
  definitions: Record<string, UnitDefinition>,
  catalog: CombatCatalog,
  rng: PRNG,
  arenaWidth: number = FIELD_WIDTH,
  arenaHeight: number = FIELD_HEIGHT,
): UnitEntityBundle[] {
  return createSpawnBuildSpecs(spec, definitions, catalog, rng, arenaWidth, arenaHeight).flatMap(buildSpec => {
    const compiled = compileUnit(buildSpec)
    return compiled ? [compiled] : []
  })
}

export function createSpawnBuildSpecs(
  spec: UnitSpawnSpec,
  definitions: Record<string, UnitDefinition>,
  catalog: CombatCatalog,
  rng: PRNG,
  arenaWidth: number = FIELD_WIDTH,
  arenaHeight: number = FIELD_HEIGHT,
): UnitBuildSpec[] {
  const def = definitions[spec.definitionId]
  if (!def) return []
  const squadSize = def.squadSize || 1
  const spacing = def.squadSpacing || 20
  const rowSize = Math.ceil(Math.sqrt(squadSize))
  const rawX = spec.placement.x != null
    ? spec.placement.x
    : Math.floor(rng.next() * arenaWidth)
  const rawY = spec.placement.y != null
    ? spec.placement.y
    : Math.floor(rng.next() * 320) + (spec.team === 'attacker' ? arenaHeight - 320 : 0)
  const centerX = Number(rawX)
  const centerY = Number(rawY)
  const squadId = squadSize > 1 ? (spec.instanceId + '_squad') : undefined
  return Array.from({ length: squadSize }, (_, index) => {
    const offset = getFormationOffset(
      index,
      squadSize,
      rowSize,
      spacing,
      def.formation || 'grid',
      spec.team,
    )
    const angle = spec.placement.angle ?? (spec.team === 'attacker' ? Math.PI / 2 : -Math.PI / 2)
    return {
      definitionId: spec.definitionId,
      identity: {
        id: squadSize > 1 ? (spec.instanceId + '_' + index) : spec.instanceId,
        team: spec.team,
        squadId,
      },
      loadout: {
        rank: spec.rank,
        upgradeIds: spec.upgradeIds ? [...spec.upgradeIds] : [],
      },
      placement: {
        x: centerX + offset.x,
        y: centerY + offset.y,
        angle,
        offsetX: offset.x,
        offsetY: offset.y,
      },
      overrides: { currentHp: spec.currentHp },
      catalog,
    }
  })
}
