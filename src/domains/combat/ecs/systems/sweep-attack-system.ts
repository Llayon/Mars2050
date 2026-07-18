import type { BattleAction } from '../../combat.actions'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { resolveEcsSecondaryHit } from './secondary-hit-system'

interface EcsSweepHit {
  targetId: EntityId
  multiplier: number
}

export function canUseEcsSweepAttack(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): boolean {
  if (!world.stores.weapon.require(attackerId).sweepAttack) return true
  return world.resources.get('entitySpatial') !== undefined
}

export function applyEcsSweepAttack(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  actions: BattleAction[],
): void {
  const attacker = world.stores.identity.require(attackerId).id
  const attack = world.stores.combat.require(attackerId).attack
  for (const hit of getSweepHits(world, attackerId, primaryId)) {
    actions.push({
      unitId: attacker,
      type: 'sweep_hit',
      targetId: world.stores.identity.require(hit.targetId).id,
      value: hit.multiplier,
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

function getSweepHits(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): EcsSweepHit[] {
  const config = world.stores.weapon.require(attackerId).sweepAttack
  if (!config) return []
  const attacker = world.stores.transform.require(attackerId)
  const primary = world.stores.transform.require(primaryId)
  const identity = world.stores.identity.require(attackerId)
  const range = world.stores.combat.require(attackerId).range
  return world.resources.require('entitySpatial')
    .query(world, attacker.x, attacker.y, range)
    .filter(targetId => {
      if (targetId === primaryId || world.stores.vitality.require(targetId).isDead) return false
      const target = world.stores.transform.require(targetId)
      return world.stores.identity.require(targetId).team !== identity.team &&
        Math.abs(target.x - primary.x) <= config.width &&
        getDistance(attacker.x, attacker.y, target.x, target.y) <= range
    })
    .sort((leftId, rightId) => {
      const left = world.stores.transform.require(leftId)
      const right = world.stores.transform.require(rightId)
      return Math.abs(left.y - primary.y) - Math.abs(right.y - primary.y) ||
        compareIds(world, leftId, rightId)
    })
    .slice(0, config.maxTargets ?? Number.MAX_SAFE_INTEGER)
    .map(targetId => ({
      targetId,
      multiplier: config.damageMultiplier *
        (config.sizeBonusMultiplier?.[world.stores.transform.require(targetId).size] ?? 1),
    }))
}

function compareIds(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  return world.stores.identity.require(leftId).id.localeCompare(world.stores.identity.require(rightId).id)
}
