import type { BattleAction } from '../../combat.actions.js'
import { getDistance } from '../../combat.utils.js'
import type { CombatWorld } from '../combat-world.js'
import { compareEntityExternalIdsForMode } from '../authored-order.js'
import type { EntityId } from '../entity.js'
import { applyEcsStatus } from './status-application-system.js'

export function getEcsFormationBonusEntities(world: CombatWorld): readonly EntityId[] {
  return world.query(['identity', 'transform', 'vitality', 'support', 'formationBonusCapability'])
}

export function runEcsFormationBonusSystem(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
  entityIds = getEcsFormationBonusEntities(world),
): void {
  if (tick % 10 !== 0) return
  const ordered = [...entityIds].sort((left, right) =>
    compareEntityExternalIdsForMode(world, left, right),
  )
  for (const entityId of ordered) {
    const config = world.stores.support.require(entityId)
      .formationModifiers?.adjacencyBonus
    if (!config) continue
    const stacks = Math.min(
      config.maxStacks,
      countAdjacentSameTypeAllies(world, entityId, config.radius),
    )
    if (stacks <= 0) continue
    const identity = world.stores.identity.require(entityId)
    actions.push({
      unitId: identity.id,
      type: 'adjacency_bonus',
      value: stacks,
    })
    if (config.damageReductionPerAlly) {
      applyFormationStatus(
        world,
        entityId,
        'damage_reduction',
        config.damageReductionPerAlly * stacks,
        actions,
      )
    }
    if (config.rangeBoostPerAlly) {
      applyFormationStatus(
        world,
        entityId,
        'range_boost',
        config.rangeBoostPerAlly * stacks,
        actions,
      )
    }
    if (config.attackBoostPerAlly) {
      applyFormationStatus(
        world,
        entityId,
        'attack_boost',
        config.attackBoostPerAlly * stacks,
        actions,
      )
    }
  }
}

function applyFormationStatus(
  world: CombatWorld,
  entityId: EntityId,
  type: 'damage_reduction' | 'range_boost' | 'attack_boost',
  value: number,
  actions: BattleAction[],
): void {
  const externalId = world.stores.identity.require(entityId).id
  applyEcsStatus(world, entityId, {
    type,
    duration: 11,
    value,
    sourceUnitId: 'formation',
    stackKey: externalId,
  }, actions)
}

function countAdjacentSameTypeAllies(
  world: CombatWorld,
  sourceId: EntityId,
  radius: number,
): number {
  const sourceIdentity = world.stores.identity.require(sourceId)
  const source = world.stores.transform.require(sourceId)
  return world.resources.require('entitySpatial')
    .query(world, source.x, source.y, radius)
    .filter(entityId => {
      if (entityId === sourceId) return false
      const identity = world.stores.identity.require(entityId)
      const transform = world.stores.transform.require(entityId)
      return identity.team === sourceIdentity.team &&
        identity.type === sourceIdentity.type &&
        getDistance(source.x, source.y, transform.x, transform.y) <= radius
    })
    .length
}
