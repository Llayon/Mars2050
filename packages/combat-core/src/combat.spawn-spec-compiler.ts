import type { ArenaDeployment, ArenaSpec, UnitDefinition, UnitSpawnSpec } from './contracts/index.js'
import type { Team } from './combat.sim.types.js'
import type { UnitBuildSpec } from './combat.unit-build.types.js'
import { compileUnit } from './combat.unit-compiler.js'
import type { UnitEntityBundle } from './ecs/unit-entity-bundle.js'
import type { CombatCatalog } from './combat.catalog.types.js'
import { FIELD_HEIGHT, FIELD_WIDTH, type PRNG } from './combat.utils.js'
import { getFormationOffset } from './math/index.js'
import { resolveDeploymentBounds } from './combat.deployment-bounds.js'

export type ArenaInput = ArenaSpec | { width: number; height: number; deployment?: ArenaDeployment } | number

export function compileSpawnSpecBundles(
  spec: UnitSpawnSpec,
  definitions: Record<string, UnitDefinition>,
  catalog: CombatCatalog,
  rng: PRNG,
  arenaOrWidth: ArenaInput = FIELD_WIDTH,
  arenaHeight: number = FIELD_HEIGHT,
): UnitEntityBundle[] {
  return createSpawnBuildSpecs(spec, definitions, catalog, rng, arenaOrWidth, arenaHeight).flatMap(buildSpec => {
    const compiled = compileUnit(buildSpec)
    return compiled ? [compiled] : []
  })
}

export function createSpawnBuildSpecs(
  spec: UnitSpawnSpec,
  definitions: Record<string, UnitDefinition>,
  catalog: CombatCatalog,
  rng: PRNG,
  arenaOrWidth: ArenaInput = FIELD_WIDTH,
  arenaHeightParam: number = FIELD_HEIGHT,
): UnitBuildSpec[] {
  const arenaWidth = typeof arenaOrWidth === 'object' ? arenaOrWidth.width : arenaOrWidth
  const arenaHeight = typeof arenaOrWidth === 'object' ? arenaOrWidth.height : arenaHeightParam
  const arenaObj = typeof arenaOrWidth === 'object' ? arenaOrWidth : { width: arenaWidth, height: arenaHeight }

  const def = definitions[spec.definitionId] ?? catalog?.unitTypes?.[spec.definitionId]
  if (!def) return []
  const squadSize = Math.max(1, Math.floor(def.squadSize || 1))
  const spacing = def.squadSpacing || 20
  const rowSize = Math.ceil(Math.sqrt(squadSize))

  const bounds = resolveDeploymentBounds(arenaObj, spec.team)
  const zoneWidth = bounds.maxX - bounds.minX
  const zoneHeight = bounds.maxY - bounds.minY

  let leftPad = 0, rightPad = 0, topPad = 0, bottomPad = 0
  if (squadSize > 1) {
    const offsets = Array.from({ length: squadSize }, (_, index) =>
      getFormationOffset(index, squadSize, rowSize, spacing, def.formation || 'grid', spec.team),
    )
    leftPad = Math.max(0, -Math.min(...offsets.map(o => o.x)))
    rightPad = Math.max(0, Math.max(...offsets.map(o => o.x)))
    topPad = Math.max(0, -Math.min(...offsets.map(o => o.y)))
    bottomPad = Math.max(0, Math.max(...offsets.map(o => o.y)))
  }

  const availX = Math.max(1, zoneWidth - leftPad - rightPad)
  const availY = Math.max(1, zoneHeight - topPad - bottomPad)

  const rawX = spec.placement.x != null
    ? spec.placement.x
    : Math.floor(rng.next() * availX) + bounds.minX + leftPad
  const rawY = spec.placement.y != null
    ? spec.placement.y
    : Math.floor(rng.next() * availY) + bounds.minY + topPad
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
