import type { BattleAction } from '../../combat.actions'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsShareRecipients } from './damage-sharing-system'
import { canResolveSimpleEcsDeath } from './death-system'
import { resolveEcsSecondaryHit } from './secondary-hit-system'

const GRID_TO_PIXELS = 40
const CANDIDATE_MARGIN = 240

export function canUseEcsSideWeapon(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): boolean {
  if (!world.stores.weapon.require(attackerId).sideWeapon) return true
  if (!world.resources.get('entitySpatial')) return false
  return getSideWeaponTargets(world, attackerId, primaryId).every(targetId =>
    canResolveSimpleEcsDeath(world, targetId) &&
    getEcsShareRecipients(world, targetId).every(recipientId =>
      canResolveSimpleEcsDeath(world, recipientId),
    ),
  )
}

export function applyEcsSideWeapon(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  actions: BattleAction[],
): void {
  const config = world.stores.weapon.require(attackerId).sideWeapon
  if (!config || config.damage <= 0) return
  const attacker = world.stores.identity.require(attackerId).id
  for (const targetId of getSideWeaponTargets(world, attackerId, primaryId)) {
    actions.push({
      unitId: attacker,
      type: 'side_weapon_attack',
      targetId: world.stores.identity.require(targetId).id,
    })
    resolveEcsSecondaryHit(world, attackerId, targetId, config.damage, actions, {
      applyOnHitEffects: false,
    })
  }
}

function getSideWeaponTargets(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): EntityId[] {
  const config = world.stores.weapon.require(attackerId).sideWeapon
  if (!config) return []
  const attacker = world.stores.transform.require(attackerId)
  const attackerIdentity = world.stores.identity.require(attackerId)
  const combat = world.stores.combat.require(attackerId)
  const range = config.range * GRID_TO_PIXELS
  return world.resources.require('entitySpatial')
    .query(world, attacker.x, attacker.y, combat.range + CANDIDATE_MARGIN)
    .filter(targetId => {
      if (targetId === primaryId || world.stores.vitality.require(targetId).isDead) return false
      if (world.stores.identity.require(targetId).team === attackerIdentity.team) return false
      return !world.stores.transform.require(targetId).isFlying ||
        config.canTargetAir === true || combat.canTargetAir === true
    })
    .map(targetId => ({ targetId, distance: getDistanceTo(world, attackerId, targetId) }))
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
