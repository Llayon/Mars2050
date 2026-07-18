import type { BattleAction } from '../../combat.actions'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsShareRecipients } from './damage-sharing-system'
import { canResolveEcsDeath } from './death-system'
import { resolveEcsSecondaryHit } from './secondary-hit-system'

export function canUseEcsConditionalAttack(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): boolean {
  if (!world.stores.weapon.require(attackerId).conditionalAttackMode) return true
  if (!world.resources.get('entitySpatial')) return false
  return getConditionalTargets(world, attackerId, primaryId).every(targetId =>
    canResolveEcsDeath(world, targetId) &&
    getEcsShareRecipients(world, targetId).every(recipientId =>
      canResolveEcsDeath(world, recipientId),
    ),
  )
}

export function applyEcsConditionalAttack(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  actions: BattleAction[],
): void {
  const config = world.stores.weapon.require(attackerId).conditionalAttackMode
  if (!config) return
  const targets = getConditionalTargets(world, attackerId, primaryId)
  if (targets.length === 0) return
  const attacker = world.stores.identity.require(attackerId).id
  actions.push({
    unitId: attacker,
    type: 'conditional_attack_mode',
    targetId: world.stores.identity.require(primaryId).id,
    radius: config.radius,
    value: config.damageMultiplier,
  })
  const damage = Math.max(0, Math.floor(
    world.stores.combat.require(attackerId).attack * config.damageMultiplier,
  ))
  for (const targetId of targets) {
    resolveEcsSecondaryHit(world, attackerId, targetId, damage, actions)
  }
}

function getConditionalTargets(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): EntityId[] {
  const config = world.stores.weapon.require(attackerId).conditionalAttackMode
  if (!config) return []
  const primary = world.stores.transform.require(primaryId)
  const attacker = world.stores.identity.require(attackerId)
  const candidates = world.resources.require('entitySpatial')
    .query(world, primary.x, primary.y, config.radius)
    .filter(targetId =>
      !world.stores.vitality.require(targetId).isDead &&
      world.stores.identity.require(targetId).team !== attacker.team,
    )
    .sort((leftId, rightId) =>
      getDistanceTo(world, primaryId, leftId) - getDistanceTo(world, primaryId, rightId) ||
      compareIds(world, leftId, rightId),
    )
  if (candidates.length < config.minTargets) return []
  return candidates.filter(targetId => targetId !== primaryId)
}

function getDistanceTo(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  const left = world.stores.transform.require(leftId)
  const right = world.stores.transform.require(rightId)
  return getDistance(left.x, left.y, right.x, right.y)
}

function compareIds(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  return world.stores.identity.require(leftId).id.localeCompare(world.stores.identity.require(rightId).id)
}
