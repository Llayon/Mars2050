import type { BattleAction } from '../../combat.actions'
import type { TriggerPayload } from '../../combat.sim.types'
import type { UnitTypeKey } from '../../combat.types'
import { compileUnit } from '../../combat.unit-compiler'
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
  const existing = world.getActiveSummons(ownerId).filter(entityId => {
    const identity = world.stores.identity.require(entityId)
    return identity.summonSourceId === sourceKey
  }).length
  const count = Math.max(1, payload.count ?? 1)
  let spawned = 0

  for (let index = 0; index < count && existing + spawned < cap; index++) {
    const position = getSpawnPosition(anchor)
    const unit = compileUnit({
      definitionId: payload.unitType as UnitTypeKey,
      identity: {
        id: world.allocateExternalId(`trigger_${owner.id}_${sourceKey}`),
        team: owner.team,
        summonOwnerId: owner.id,
        summonSourceId: sourceKey,
      },
      loadout: { rank: 1, upgradeIds: [] },
      placement: {
        x: position.x,
        y: position.y,
        angle: ownerTransform.currentAngle,
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
      unitId: owner.id,
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
