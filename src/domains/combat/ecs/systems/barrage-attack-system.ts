import type { BattleAction } from '../../combat.actions'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { resolveEcsSecondaryHit } from './secondary-hit-system'

interface EcsBarrageImpact {
  index: number
  x: number
  y: number
  radius: number
}

export function canUseEcsBarrageAttack(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): boolean {
  if (!world.stores.weapon.require(attackerId).barrageAttack) return true
  return world.resources.get('entitySpatial') !== undefined
}

export function applyEcsBarrageAttack(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  actions: BattleAction[],
): void {
  const config = world.stores.weapon.require(attackerId).barrageAttack
  if (!config) return
  const attacker = world.stores.identity.require(attackerId).id
  const primary = world.stores.identity.require(primaryId).id
  const damage = Math.floor(world.stores.combat.require(attackerId).attack * config.damageMultiplier)
  for (const impact of getImpacts(world, attackerId, primaryId)) {
    const event = {
      unitId: attacker,
      targetId: primary,
      toX: impact.x,
      toY: impact.y,
      radius: impact.radius,
      value: impact.index,
    }
    actions.push({ ...event, type: 'barrage_marker' })
    for (const targetId of getTargets(world, attackerId, impact)) {
      resolveEcsSecondaryHit(world, attackerId, targetId, damage, actions, {
        interceptable: true,
      })
    }
    actions.push({ ...event, type: 'barrage_impact' })
  }
}

function getImpacts(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): EcsBarrageImpact[] {
  const config = world.stores.weapon.require(attackerId).barrageAttack
  if (!config) return []
  const primary = world.stores.transform.require(primaryId)
  return Array.from({ length: config.impacts }, (_, index) => {
    const offset = getOffset(index, config.spreadRadius)
    return {
      index,
      x: primary.x + offset.x,
      y: primary.y + offset.y,
      radius: config.radius,
    }
  })
}

function getTargets(
  world: CombatWorld,
  attackerId: EntityId,
  impact: EcsBarrageImpact,
): EntityId[] {
  const config = world.stores.weapon.require(attackerId).barrageAttack
  if (!config) return []
  const attacker = world.stores.identity.require(attackerId)
  const combat = world.stores.combat.require(attackerId)
  return world.resources.require('entitySpatial')
    .query(world, impact.x, impact.y, impact.radius)
    .filter(targetId => {
      if (world.stores.vitality.require(targetId).isDead) return false
      if (world.stores.identity.require(targetId).team === attacker.team) return false
      return !world.stores.transform.require(targetId).isFlying || combat.canTargetAir === true
    })
    .map(targetId => ({
      targetId,
      distance: getDistanceTo(world, impact.x, impact.y, targetId),
    }))
    .filter(hit => hit.distance <= impact.radius +
      getSizeRadius(world.stores.transform.require(hit.targetId).size))
    .sort((left, right) => left.distance - right.distance ||
      compareIds(world, left.targetId, right.targetId))
    .slice(0, config.maxTargetsPerImpact ?? Number.MAX_SAFE_INTEGER)
    .map(hit => hit.targetId)
}

function getOffset(index: number, spreadRadius: number): { x: number; y: number } {
  if (index === 0 || spreadRadius <= 0) return { x: 0, y: 0 }
  const angle = (index - 1) * 2.399963229728653
  const ring = 0.55 + (index % 3) * 0.225
  return {
    x: Math.cos(angle) * spreadRadius * ring,
    y: Math.sin(angle) * spreadRadius * ring,
  }
}

function getDistanceTo(world: CombatWorld, x: number, y: number, targetId: EntityId): number {
  const target = world.stores.transform.require(targetId)
  return getDistance(x, y, target.x, target.y)
}

function compareIds(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  return world.stores.identity.require(leftId).id.localeCompare(world.stores.identity.require(rightId).id)
}
