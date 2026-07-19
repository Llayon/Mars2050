import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { RuntimeActionContext, RuntimeActionResult } from '../../combat.runtime'
import type { UnitTypeKey } from '../../combat.types'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsEffectiveActionRangeAgainst } from '../movement-positioning'
import { getEcsCombatTags } from '../targeting-evaluation'
import { applyEcsHealing } from './healing-system'
import { canUseSimpleSingleDamage, runSimpleSingleDamage } from './single-damage-system'
import { canUseEcsMineAction, runEcsMineAction } from './mine-action-system'
import { canUseEcsSmokeAction, runEcsSmokeAction } from './smoke-action-system'
import { canUseEcsSpawnAction, runEcsSpawnAction } from './spawn-action-system'
import { syncEcsBurrowForAction } from './emerge-strike-system'
import {
  getEcsActionCooldown,
  prepareEcsStanceForAction,
  syncEcsModeForAction,
} from './action-setup'

const FACING_TOLERANCE = 0.26

export function runActionSystem(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  context: RuntimeActionContext,
): RuntimeActionResult {
  world.resources.set('rng', context.rng)
  const weapon = world.stores.weapon.require(entityId)
  if (canUseEcsMineAction(world, entityId)) {
    return runEcsMineAction(world, entityId, targetId, actions, context)
  }
  if (canUseEcsSmokeAction(world, entityId)) {
    return runEcsSmokeAction(world, entityId, targetId, actions, context)
  }
  if (canUseEcsSpawnAction(world, entityId)) {
    return runEcsSpawnAction(world, entityId, targetId, actions, context)
  }
  if (weapon.attackType !== 'heal') {
    if (!canUseSimpleSingleDamage(world, entityId, targetId)) {
      throw new Error(`Unsupported ECS action configuration: ${weapon.attackType}`)
    }
    return runSimpleSingleDamage(
      world,
      entityId,
      targetId,
      actions,
      context.tick,
      context.rng,
    )
  }
  return runHealAction(world, entityId, targetId, actions)
}

function runHealAction(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
): RuntimeActionResult {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const targetTransform = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const targetVitality = world.stores.vitality.require(targetId)
  const movement = world.stores.movement.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  if (!canHealTarget(world, identity.type, targetId)) return notActed()
  const distance = getDistance(transform.x, transform.y, targetTransform.x, targetTransform.y) -
    getSizeRadius(targetTransform.size) - getSizeRadius(transform.size)
  if (targetVitality.hp >= targetVitality.maxHp ||
      distance > getEcsEffectiveActionRangeAgainst(world, entityId, targetId)) return notActed()
  const angle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x)
  if (Math.abs(normalizeAngle(angle - transform.currentAngle)) > FACING_TOLERANCE) return notActed()
  if (combat.actionCooldown > 0 || isActionBlocked(status.statusEffects)) return notActed()
  if (!prepareEcsStanceForAction(world, entityId, actions)) {
    return { acted: true, actorSynchronized: true }
  }

  syncEcsModeForAction(world, entityId, actions)
  syncEcsBurrowForAction(world, entityId, actions)
  combat.actionCooldown = getEcsActionCooldown(world, entityId)
  applyEcsHealing(world, entityId, targetId, combat.attack, actions)
  return { acted: true, actorSynchronized: true }
}

function canHealTarget(world: CombatWorld, sourceType: string, targetId: EntityId): boolean {
  const tags = UNIT_TYPES[sourceType as UnitTypeKey]?.baseStats.healTargetTags
  if (!tags?.length) return true
  const targetTags = new Set(getEcsCombatTags(world, targetId))
  return tags.some(tag => targetTags.has(tag))
}

function isActionBlocked(effects: { type: string; duration: number }[]): boolean {
  return effects.some(effect => effect.duration > 0 && (effect.type === 'emp' || effect.type === 'hacked'))
}

function notActed(): RuntimeActionResult {
  return { acted: false, actorSynchronized: false }
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
