import { deterministicSin, deterministicCos } from '../../math/deterministic-trig.js'
import type { BattleAction } from '../../combat.actions.js'
import type { PeriodicAbilityPayload } from '../../combat.sim.types.js'
import type { UnitTypeKey } from '../../combat.types.js'
import { getDefaultCombatCatalog } from '../../combat.catalog.types.js'
import { compileUnit } from '../../combat.unit-compiler.js'
import { getSizeRadius } from '../../math/geometry.js'
import { getCombatArena } from '../combat-resources.js'
import type { CombatWorld } from '../combat-world.js'
import type { EntityId } from '../entity.js'

type SpawnPayload = Extract<PeriodicAbilityPayload, { kind: 'spawn' }>

export function spawnEcsPeriodicUnits(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  payload: SpawnPayload,
  abilityId: string,
  actions: BattleAction[],
): void {
  const source = world.stores.identity.require(sourceId)
  const sourceTransform = world.stores.transform.require(sourceId)
  const target = world.stores.transform.require(targetId)
  const cap = payload.cap ?? Number.MAX_SAFE_INTEGER
  const existing = world.getActiveSummons(sourceId)
    .filter(entityId => {
      const identity = world.stores.identity.require(entityId)
      return identity.summonSourceId === abilityId
    })
    .length
  const count = Math.max(1, payload.count ?? 1)
  const arena = getCombatArena(world)
  const catalog = world.resources.get('catalog') ?? getDefaultCombatCatalog()
  const unitCatalog = (catalog as { unitTypes?: Record<string, { baseStats?: { size?: 'S' | 'M' | 'L' | 'XL' } }> })?.unitTypes ?? {}
  const spawnUnitDef = unitCatalog[payload.unitType]
  const bodyRadius = getSizeRadius(spawnUnitDef?.baseStats?.size ?? 'M')
  let spawned = 0
  for (let index = 0; index < count && existing + spawned < cap; index++) {
    const position = getSpawnPosition(
      target,
      payload.spreadRadius ?? 0,
      index,
      count,
      arena,
      bodyRadius,
    )
    const unit = compileUnit({
      definitionId: payload.unitType as UnitTypeKey,
      identity: {
        id: world.allocateExternalId(`periodic_${source.id}_${abilityId}`),
        team: source.team,
        summonOwnerId: source.id,
        summonSourceId: abilityId,
      },
      loadout: { rank: 1, upgradeIds: [] },
      placement: {
        x: position.x,
        y: position.y,
        angle: sourceTransform.currentAngle,
      },
      spawn: { inheritance: 'base' },
      overrides: { hpPercent: payload.hpPercent },
      catalog: world.resources.get('catalog') ?? getDefaultCombatCatalog(),
      preparedStats: (spawnUnitDef as { preparedStats?: import('../../contracts/prepared.contracts.js').PreparedStats })?.preparedStats,
    })
    if (!unit) continue
    world.queueCompiledUnitCreation(unit)
    const identity = unit.components.identity
    const transform = unit.components.transform
    const vitality = unit.components.vitality
    spawned++
    actions.push({
      unitId: source.id,
      type: 'spawn',
      targetId: identity.id,
      toX: transform.x,
      toY: transform.y,
      spawnType: identity.type,
      spawnTeam: identity.team,
      spawnMaxHp: vitality.maxHp,
    })
  }
  if (spawned === 0 && cap !== Number.MAX_SAFE_INTEGER) {
    actions.push({ unitId: source.id, type: 'spawn_blocked', value: cap })
  }
  world.flushStructuralCommands()
  world.resources.require('entitySpatial').ensureCurrent(world)
}

function getSpawnPosition(
  anchor: { x: number; y: number },
  radius: number,
  index: number,
  count: number,
  arena: { width: number; height: number },
  bodyRadius: number = 0,
): { x: number; y: number } {
  if (radius <= 0 || count <= 1) {
    return { x: clamp(anchor.x, arena.width, bodyRadius), y: clamp(anchor.y, arena.height, bodyRadius) }
  }
  const angle = (Math.PI * 2 * index) / count
  return {
    x: clamp(anchor.x + deterministicCos(angle) * radius, arena.width, bodyRadius),
    y: clamp(anchor.y + deterministicSin(angle) * radius, arena.height, bodyRadius),
  }
}

function clamp(value: number, maximum: number, bodyRadius: number = 0): number {
  const min = Math.min(maximum / 2, bodyRadius)
  const max = Math.max(maximum / 2, maximum - bodyRadius)
  return Math.max(min, Math.min(max, value))
}
