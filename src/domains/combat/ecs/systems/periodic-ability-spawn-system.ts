import type { BattleAction } from '../../combat.actions'
import type { PeriodicAbilityPayload } from '../../combat.sim.types'
import { createRuntimeUnitFromConfig } from '../../combat.unit-factory'
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
  const existing = world.query(['identity', 'vitality', 'entityTargets'], true)
    .filter(entityId => {
      const identity = world.stores.identity.require(entityId)
      return !world.stores.vitality.require(entityId).isDead &&
        world.stores.entityTargets.require(entityId).summonOwner === sourceId &&
        identity.summonSourceId === abilityId
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
    const unit = createRuntimeUnitFromConfig({
      id: world.allocateExternalId(`periodic_${source.id}_${abilityId}`),
      team: source.team,
      type: payload.unitType,
      x: position.x,
      y: position.y,
      summonOwnerId: source.id,
      summonSourceId: abilityId,
      currentAngle: sourceTransform.currentAngle,
    })
    if (!unit) continue
    if (payload.hpPercent !== undefined) {
      unit.hp = Math.max(1, Math.floor(unit.maxHp * payload.hpPercent))
      unit.maxHp = unit.hp
    }
    world.queueUnitCreation(unit)
    spawned++
    actions.push({
      unitId: source.id,
      type: 'spawn',
      targetId: unit.id,
      toX: unit.x,
      toY: unit.y,
      spawnType: unit.type,
      spawnTeam: unit.team,
      spawnMaxHp: unit.maxHp,
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
