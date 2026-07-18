import type { BattleAction } from '../../combat.actions'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { resolveEcsSecondaryHit } from './secondary-hit-system'

const GRID_TO_PIXELS = 40
const CANDIDATE_MARGIN = 240

export function canUseEcsSplitFire(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): boolean {
  if (!world.stores.weapon.require(attackerId).splitFire) return true
  return world.resources.get('entitySpatial') !== undefined
}

export function applyEcsSplitFire(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  actions: BattleAction[],
): void {
  const config = world.stores.weapon.require(attackerId).splitFire
  if (!config) return
  const identity = world.stores.identity.require(attackerId).id
  const damage = Math.floor(world.stores.combat.require(attackerId).attack * config.damageMultiplier)
  for (const targetId of getSplitFireTargets(world, attackerId, primaryId)) {
    actions.push({
      unitId: identity,
      type: 'split_fire',
      targetId: world.stores.identity.require(targetId).id,
    })
    resolveEcsSecondaryHit(world, attackerId, targetId, damage, actions, {
      allowMinimumDamage: config.allowMinimumDamage ?? true,
    })
  }
}

function getSplitFireTargets(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): EntityId[] {
  const config = world.stores.weapon.require(attackerId).splitFire
  if (!config) return []
  const attacker = world.stores.transform.require(attackerId)
  const attackerIdentity = world.stores.identity.require(attackerId)
  const combat = world.stores.combat.require(attackerId)
  const range = (config.range ?? combat.range / GRID_TO_PIXELS) * GRID_TO_PIXELS
  return world.resources.require('entitySpatial')
    .query(world, attacker.x, attacker.y, combat.range + CANDIDATE_MARGIN)
    .filter(targetId => {
      if (targetId === primaryId || world.stores.vitality.require(targetId).isDead) return false
      if (world.stores.identity.require(targetId).team === attackerIdentity.team) return false
      return !world.stores.transform.require(targetId).isFlying ||
        config.canTargetAir === true || combat.canTargetAir === true
    })
    .map(targetId => ({
      targetId,
      distance: getDistanceTo(world, attackerId, targetId),
    }))
    .filter(hit => hit.distance <= range + getSizeRadius(world.stores.transform.require(hit.targetId).size))
    .sort((left, right) => left.distance - right.distance || compareIds(world, left.targetId, right.targetId))
    .slice(0, config.maxTargets)
    .map(hit => hit.targetId)
}

function getDistanceTo(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  const left = world.stores.transform.require(leftId)
  const right = world.stores.transform.require(rightId)
  return getDistance(left.x, left.y, right.x, right.y)
}

function compareIds(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  return world.stores.identity.require(leftId).id.localeCompare(world.stores.identity.require(rightId).id)
}
