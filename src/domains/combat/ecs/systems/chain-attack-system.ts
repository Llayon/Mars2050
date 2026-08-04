import type { BattleAction } from '../../combat.actions'
import type { ChainAttackConfig } from '../../combat.primitives'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { resolveEcsSecondaryHit } from './secondary-hit-system'

const CANDIDATE_MARGIN = 240

interface EcsChainHit {
  targetId: EntityId
  jump: number
  multiplier: number
}

export function canUseEcsChainAttack(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): boolean {
  if (!world.stores.weapon.require(attackerId).chainAttack) return true
  return world.resources.get('entitySpatial') !== undefined
}

export function applyEcsChainAttack(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  actions: BattleAction[],
  overrideConfig?: ChainAttackConfig,
): void {
  const attacker = world.stores.identity.require(attackerId).id
  const attack = world.stores.combat.require(attackerId).attack
  for (const hit of getChainHits(world, attackerId, primaryId, overrideConfig)) {
    actions.push({
      unitId: attacker,
      type: 'chain_jump',
      targetId: world.stores.identity.require(hit.targetId).id,
      value: hit.jump,
    })
    resolveEcsSecondaryHit(
      world,
      attackerId,
      hit.targetId,
      Math.floor(attack * hit.multiplier),
      actions,
    )
  }
}

function getChainHits(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  overrideConfig?: ChainAttackConfig,
): EcsChainHit[] {
  const config = overrideConfig ?? world.stores.weapon.require(attackerId).chainAttack
  if (!config) return []
  const primary = world.stores.transform.require(primaryId)
  const combat = world.stores.combat.require(attackerId)
  const candidates = world.resources.require('entitySpatial')
    .query(world, primary.x, primary.y, combat.range + CANDIDATE_MARGIN)
  const hits: EcsChainHit[] = []
  const visited = new Set<EntityId>([primaryId])
  let originId = primaryId

  for (let jump = 1; jump <= config.jumps; jump++) {
    const targetId = getNextTarget(world, attackerId, originId, candidates, visited, config.radius)
    if (targetId === undefined) break
    visited.add(targetId)
    hits.push({
      targetId,
      jump,
      multiplier: config.damageMultiplier * Math.pow(config.falloff ?? 1, jump - 1),
    })
    originId = targetId
  }
  return hits
}

function getNextTarget(
  world: CombatWorld,
  attackerId: EntityId,
  originId: EntityId,
  candidates: EntityId[],
  visited: ReadonlySet<EntityId>,
  radius: number,
): EntityId | undefined {
  const attacker = world.stores.identity.require(attackerId)
  const combat = world.stores.combat.require(attackerId)
  return candidates
    .filter(targetId => {
      if (visited.has(targetId) || world.stores.vitality.require(targetId).isDead) return false
      if (world.stores.identity.require(targetId).team === attacker.team) return false
      return !world.stores.transform.require(targetId).isFlying || combat.canTargetAir === true
    })
    .map(targetId => ({ targetId, distance: getDistanceTo(world, originId, targetId) }))
    .filter(hit => hit.distance <= radius + getSizeRadius(world.stores.transform.require(hit.targetId).size))
    .sort((left, right) => left.distance - right.distance || compareIds(world, left.targetId, right.targetId))
    .at(0)?.targetId
}

function getDistanceTo(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  const left = world.stores.transform.require(leftId)
  const right = world.stores.transform.require(rightId)
  return getDistance(left.x, left.y, right.x, right.y)
}

function compareIds(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  return world.stores.identity.require(leftId).id.localeCompare(world.stores.identity.require(rightId).id)
}
