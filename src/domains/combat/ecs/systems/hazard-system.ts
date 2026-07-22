import type { BattleAction } from '../../combat.actions'
import type { DeathCause } from '../../combat.death.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsStatus } from './status-application-system'

export type EcsHazardDeathHandler = (
  entityId: EntityId,
  sourceId: EntityId | undefined,
  cause: DeathCause,
) => void

export function runHazardSystem(
  world: CombatWorld,
  actions: BattleAction[],
  onUnitDeath: EcsHazardDeathHandler,
): void {
  const hazardIds = [...world.query(['entityMeta', 'hazard'], true)].reverse()
  for (const hazardId of hazardIds) {
    const hazard = world.stores.hazard.get(hazardId)
    if (!hazard) continue
    hazard.duration--
    if (hazard.duration <= 0) {
      if (hazard.type === 'barrier_dome' && (hazard.capacity ?? 0) > 0) {
        actions.push({ unitId: hazard.sourceUnitId ?? hazard.id, type: 'barrier_expire', hazardId: hazard.id })
      }
      world.removeHazardEntity(hazardId)
      continue
    }
    if (hazard.type === 'mine') {
      if (processMine(world, hazardId, actions, onUnitDeath)) world.removeHazardEntity(hazardId)
      continue
    }
    if (hazard.type === 'smoke') {
      processSmoke(world, hazardId, actions)
      continue
    }
    if (hazard.damagePerTick > 0 && hazard.duration % 10 === 0) {
      for (const targetId of getTargetsInRadius(world, hazardId)) {
        const vitality = world.stores.vitality.require(targetId)
        vitality.hp -= hazard.damagePerTick
        actions.push(createDamageAction(world, hazard, targetId))
        if (vitality.hp <= 0 && !vitality.isDead) onUnitDeath(
          targetId,
          world.stores.entitySources.require(hazardId).hazardSource,
          'hazard',
        )
      }
    }
  }
}

function processMine(world: CombatWorld, hazardId: EntityId, actions: BattleAction[], onDeath: EcsHazardDeathHandler): boolean {
  const hazard = world.stores.hazard.require(hazardId)
  const targets = getTargetsInRadius(world, hazardId)
    .filter(entityId => world.stores.identity.require(entityId).team !== hazard.team)
    .sort((left, right) => getExternalId(world, left).localeCompare(getExternalId(world, right)))
  if (targets.length === 0) return false
  for (const targetId of targets) {
    const vitality = world.stores.vitality.require(targetId)
    vitality.hp -= hazard.damagePerTick
    actions.push(createDamageAction(world, hazard, targetId))
    if (vitality.hp <= 0 && !vitality.isDead) onDeath(
      targetId,
      world.stores.entitySources.require(hazardId).hazardSource,
      'mine',
    )
  }
  return true
}

function processSmoke(world: CombatWorld, hazardId: EntityId, actions: BattleAction[]): void {
  const hazard = world.stores.hazard.require(hazardId)
  if (hazard.duration % 10 !== 0 || !hazard.statusEffects?.length) return
  const targets = getTargetsInRadius(world, hazardId)
    .sort((left, right) => getExternalId(world, left).localeCompare(getExternalId(world, right)))
  for (const targetId of targets) {
    for (const effect of hazard.statusEffects) applyEcsStatus(world, targetId, {
      ...effect,
      sourceUnitId: hazard.sourceUnitId ?? hazard.id,
      stackKey: hazard.id,
    }, actions)
  }
}

function getTargetsInRadius(world: CombatWorld, hazardId: EntityId): EntityId[] {
  const hazard = world.stores.hazard.require(hazardId)
  return world.resources.require('entitySpatial').query(world, hazard.x, hazard.y, hazard.radius).filter(entityId => {
    const transform = world.stores.transform.require(entityId)
    return !transform.isFlying
  })
}

function createDamageAction(
  world: CombatWorld,
  hazard: ReturnType<CombatWorld['stores']['hazard']['require']>,
  targetId: EntityId,
): BattleAction {
  const action: BattleAction = { unitId: hazard.sourceUnitId ?? hazard.id, type: 'damage', targetId: getExternalId(world, targetId), damage: hazard.damagePerTick, hazardId: hazard.id, damageKind: 'hazard' }
  if (hazard.sourceUnitId) action.sourceUnitId = hazard.sourceUnitId
  return action
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.entityMeta.require(entityId).externalId
}
