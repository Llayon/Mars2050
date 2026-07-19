import type { BattleAction } from '../../combat.actions'
import type { TriggerPayload } from '../../combat.sim.types'
import { createRuntimeUnitFromConfig } from '../../combat.unit-factory'
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

type SpawnPayload = Extract<TriggerPayload, { kind: 'spawn' }>

export function spawnEcsTriggerUnits(
  world: CombatWorld,
  ownerId: EntityId,
  anchorId: EntityId,
  payload: SpawnPayload,
  actions: BattleAction[],
): void {
  const owner = world.stores.identity.require(ownerId)
  const anchor = world.stores.transform.require(anchorId)
  const ownerTransform = world.stores.transform.require(ownerId)
  const sourceKey = payload.unitType
  const cap = payload.cap ?? Number.MAX_SAFE_INTEGER
  const existing = world.query(['identity', 'vitality'], true).filter(entityId => {
    const identity = world.stores.identity.require(entityId)
    return !world.stores.vitality.require(entityId).isDead &&
      identity.summonOwnerId === owner.id &&
      identity.summonSourceId === sourceKey
  }).length
  const count = Math.max(1, payload.count ?? 1)
  let spawned = 0

  for (let index = 0; index < count && existing + spawned < cap; index++) {
    const position = getSpawnPosition(anchor)
    const unit = createRuntimeUnitFromConfig({
      id: `trigger_${owner.id}_${sourceKey}_${Math.floor(
        world.resources.require('rng').next() * 1000000,
      )}`,
      team: owner.team,
      type: payload.unitType,
      x: position.x,
      y: position.y,
      summonOwnerId: owner.id,
      summonSourceId: sourceKey,
      currentAngle: ownerTransform.currentAngle,
    })
    if (!unit) continue
    if (payload.hpPercent !== undefined) {
      unit.hp = Math.max(1, Math.floor(unit.maxHp * payload.hpPercent))
      unit.maxHp = unit.hp
    }
    world.queueUnitCreation(unit)
    spawned++
    actions.push({
      unitId: owner.id,
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
    actions.push({ unitId: owner.id, type: 'spawn_blocked', value: cap })
  }
}

function getSpawnPosition(
  anchor: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: clamp(anchor.x, FIELD_WIDTH),
    y: clamp(anchor.y, FIELD_HEIGHT),
  }
}

function clamp(value: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, value))
}
