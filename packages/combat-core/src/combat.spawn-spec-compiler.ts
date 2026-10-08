import type { ArenaDeployment, ArenaSpec, UnitDefinition, UnitSpawnSpec } from './contracts/index.js'
import type { Team } from './combat.sim.types.js'
import type { UnitBuildSpec } from './combat.unit-build.types.js'
import { compileUnit } from './combat.unit-compiler.js'
import type { UnitEntityBundle } from './ecs/unit-entity-bundle.js'
import type { CombatCatalog } from './combat.catalog.types.js'
import { FIELD_HEIGHT, FIELD_WIDTH, type PRNG } from './combat.utils.js'
import { getFormationOffset, getSizeRadius } from './math/index.js'
import { resolveDeploymentBounds } from './combat.deployment-bounds.js'
import { resolveEffectiveUnitBaseStats } from './combat.effective-loadout.js'
import type { UnitBaseStats } from './combat.types.js'

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

  const pubDef = definitions[spec.definitionId]
  const catDef = catalog?.unitTypes?.[spec.definitionId]
  if (!pubDef && !catDef) return []
  const squadSize = Math.max(1, Math.floor(pubDef?.squadSize ?? catDef?.squadSize ?? 1))
  const spacing = pubDef?.squadSpacing ?? catDef?.squadSpacing ?? 20
  const rowSize = Math.ceil(Math.sqrt(squadSize))
  const formation = pubDef?.formation ?? catDef?.formation ?? 'grid'

  const bounds = resolveDeploymentBounds(arenaObj, spec.team)
  const zoneWidth = bounds.maxX - bounds.minX
  const zoneHeight = bounds.maxY - bounds.minY

  const deployment = typeof arenaOrWidth === 'object' ? (arenaOrWidth as { deployment?: ArenaDeployment }).deployment : undefined
  const strategy = deployment?.strategy ?? 'fit_formation'

  let minSpawnX = bounds.minX
  let maxSpawnX = bounds.maxX
  let minSpawnY = bounds.minY
  let maxSpawnY = bounds.maxY

  if (strategy === 'fit_formation' || squadSize === 1) {
    const effectiveDef = catDef ?? pubDef
    const baseStats = (effectiveDef?.baseStats ?? {}) as UnitBaseStats
    const defPrep = (effectiveDef as { preparedStats?: import('./contracts/prepared.contracts.js').PreparedStats })?.preparedStats
    const effectiveBase = resolveEffectiveUnitBaseStats(resolveEffectiveUnitBaseStats(baseStats, defPrep), spec.preparedStats)
    const rawSize = effectiveBase.size ?? 'M'
    const bodyRadius = getSizeRadius(rawSize as 'S' | 'M' | 'L' | 'XL')
    const offsets = Array.from({ length: squadSize }, (_, index) =>
      getFormationOffset(index, squadSize, rowSize, spacing, formation, spec.team),
    )
    const minOffsetX = Math.min(...offsets.map(o => o.x))
    const maxOffsetX = Math.max(...offsets.map(o => o.x))
    const minOffsetY = Math.min(...offsets.map(o => o.y))
    const maxOffsetY = Math.max(...offsets.map(o => o.y))

    minSpawnX = Math.max(bounds.minX - minOffsetX, bodyRadius - minOffsetX)
    maxSpawnX = Math.min(bounds.maxX - maxOffsetX, arenaWidth - bodyRadius - maxOffsetX)
    minSpawnY = Math.max(bounds.minY - minOffsetY, bodyRadius - minOffsetY)
    maxSpawnY = Math.min(bounds.maxY - maxOffsetY, arenaHeight - bodyRadius - maxOffsetY)
    if (minSpawnX > maxSpawnX) minSpawnX = maxSpawnX
    if (minSpawnY > maxSpawnY) minSpawnY = maxSpawnY
  }

  const spanX = Math.max(0, maxSpawnX - minSpawnX)
  const spanY = Math.max(0, maxSpawnY - minSpawnY)

  const rawX = spec.placement.x != null
    ? spec.placement.x
    : Math.floor(rng.next() * Math.max(1, spanX)) + minSpawnX
  const rawY = spec.placement.y != null
    ? spec.placement.y
    : Math.floor(rng.next() * Math.max(1, spanY)) + minSpawnY
  const centerX = Number(rawX)
  const centerY = Number(rawY)
  const squadId = squadSize > 1 ? (spec.instanceId + '_squad') : undefined
  return Array.from({ length: squadSize }, (_, index) => {
    const offset = getFormationOffset(
      index,
      squadSize,
      rowSize,
      spacing,
      formation,
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
      preparedStats: spec.preparedStats,
    }
  })
}
