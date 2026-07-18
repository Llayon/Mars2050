import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsShareRecipients } from './damage-sharing-system'
import { canResolveSimpleEcsDeath } from './death-system'
import { getEcsProspectiveEmergeStrike } from './emerge-strike-system'
import { resolveEcsSecondaryHit } from './secondary-hit-system'

export function canUseEcsRadialAoe(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): boolean {
  const radiusAdd = getEcsProspectiveEmergeStrike(world, attackerId)?.aoeRadiusAdd ?? 0
  if (!hasRadialAoe(world, attackerId, radiusAdd)) return true
  if (!world.resources.get('entitySpatial')) return false
  return getRadialTargets(world, attackerId, primaryId, radiusAdd).every(targetId =>
    canResolveSimpleEcsDeath(world, targetId) &&
    getEcsShareRecipients(world, targetId).every(recipientId =>
      canResolveSimpleEcsDeath(world, recipientId),
    ),
  )
}

export function applyEcsRadialAoe(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  actions: BattleAction[],
  radiusAdd = 0,
): void {
  if (!hasRadialAoe(world, attackerId, radiusAdd)) return
  const splashDamage = Math.floor(world.stores.combat.require(attackerId).attack * 0.5)
  for (const targetId of getRadialTargets(world, attackerId, primaryId, radiusAdd)) {
    resolveEcsSecondaryHit(
      world,
      attackerId,
      targetId,
      splashDamage,
      actions,
      { emitAttackIntent: true },
    )
  }
}

function getRadialTargets(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  radiusAdd: number,
): EntityId[] {
  const radius = (world.stores.weapon.require(attackerId).aoeRadius ?? 0) + radiusAdd
  if (radius <= 0) return []
  const primary = world.stores.transform.require(primaryId)
  const attackerTeam = world.stores.identity.require(attackerId).team
  return world.resources.require('entitySpatial')
    .query(world, primary.x, primary.y, radius)
    .filter(targetId => {
      if (targetId === primaryId || world.stores.vitality.require(targetId).isDead) return false
      return world.stores.identity.require(targetId).team !== attackerTeam
    })
}

function hasRadialAoe(world: CombatWorld, attackerId: EntityId, radiusAdd: number): boolean {
  const weapon = world.stores.weapon.require(attackerId)
  return weapon.attackType === 'aoe' && (weapon.aoeRadius ?? 0) + radiusAdd > 0
}
