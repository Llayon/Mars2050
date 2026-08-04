import type { BattleAction } from '../../combat.actions'
import type { PeriodicAbilityPayload } from '../../combat.sim.types'
import type { UnitTypeKey } from '../../combat.types'
import { compileUnit } from '../../combat.unit-compiler'
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

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
  let spawned = 0
  for (let index = 0; index < count && existing + spawned < cap; index++) {
    const position = getSpawnPosition(
      target,
      payload.spreadRadius ?? 0,
      index,
      count,
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
): { x: number; y: number } {
  if (radius <= 0 || count <= 1) {
    return { x: clamp(anchor.x, FIELD_WIDTH), y: clamp(anchor.y, FIELD_HEIGHT) }
  }
  const angle = (Math.PI * 2 * index) / count
  return {
    x: clamp(anchor.x + Math.cos(angle) * radius, FIELD_WIDTH),
    y: clamp(anchor.y + Math.sin(angle) * radius, FIELD_HEIGHT),
  }
}

function clamp(value: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, value))
}
