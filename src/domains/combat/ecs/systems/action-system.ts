import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import { actionSystem } from '../../combat.systems'
import { getEffectiveCombatTags } from '../../combat.targeting-score'
import type { RuntimeActionContext, RuntimeActionResult } from '../../combat.runtime'
import type { UnitTypeKey } from '../../combat.types'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsHealing } from './healing-system'
import { canUseSimpleSingleDamage, runSimpleSingleDamage } from './single-damage-system'
import { syncEcsBurrowForAction } from './emerge-strike-system'
import {
  getEcsActionCooldown,
  getEcsStanceSetupActionRange,
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
  world.reconcileHazards()
  world.syncHazardsToComponents()
  const weapon = world.stores.weapon.require(entityId)
  if (canUseSimpleSingleDamage(world, entityId, targetId)) {
    return runSimpleSingleDamage(
      world,
      entityId,
      targetId,
      actions,
      context.tick,
      context.rng,
    )
  }
  if (weapon.attackType !== 'heal') return runLegacyAction(world, entityId, targetId, actions, context)
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
  const targetView = world.getEntity(targetId)
  if (!targetView || !canHealTarget(identity.type, targetView)) return notActed()
  const distance = getDistance(transform.x, transform.y, targetTransform.x, targetTransform.y) -
    getSizeRadius(targetTransform.size) - getSizeRadius(transform.size)
  if (targetVitality.hp >= targetVitality.maxHp ||
      distance > getEcsStanceSetupActionRange(world, entityId)) return notActed()
  const angle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x)
  if (Math.abs(normalizeAngle(angle - transform.currentAngle)) > FACING_TOLERANCE) return notActed()
  if (combat.actionCooldown > 0 || isActionBlocked(status.statusEffects)) return notActed()
  if (!prepareEcsStanceForAction(world, entityId, actions)) {
    syncActorView(world, entityId)
    return { acted: true, actorSynchronized: true }
  }

  syncEcsModeForAction(world, entityId, actions)
  syncEcsBurrowForAction(world, entityId, actions)
  combat.actionCooldown = getEcsActionCooldown(world, entityId)
  applyEcsHealing(world, entityId, targetId, combat.attack, actions)
  syncActorView(world, entityId)
  world.syncComponentsFromStore(targetId, ['vitality'])
  return { acted: true, actorSynchronized: true }
}

function runLegacyAction(world: CombatWorld, entityId: EntityId, targetId: EntityId, actions: BattleAction[], context: RuntimeActionContext): RuntimeActionResult {
  const unit = world.getEntity(entityId)
  const target = world.getEntity(targetId)
  if (!unit || !target) return notActed()
  const acted = actionSystem(unit, target, world.roster, world.hazards, actions, context.rng, context.tick, context.spatialHash)
  world.reconcileHazards()
  world.syncHazardsToComponents()
  return {
    acted,
    actorSynchronized: false,
  }
}

function canHealTarget(sourceType: string, target: NonNullable<ReturnType<CombatWorld['getEntity']>>): boolean {
  const tags = UNIT_TYPES[sourceType as UnitTypeKey]?.baseStats.healTargetTags
  if (!tags?.length) return true
  const targetTags = new Set(getEffectiveCombatTags(target))
  return tags.some(tag => targetTags.has(tag))
}

function isActionBlocked(effects: { type: string; duration: number }[]): boolean {
  return effects.some(effect => effect.duration > 0 && (effect.type === 'emp' || effect.type === 'hacked'))
}

function syncActorView(world: CombatWorld, entityId: EntityId): void {
  world.syncComponentsFromStore(entityId, ['transform', 'combat', 'weapon', 'movement'])
}

function notActed(): RuntimeActionResult {
  return { acted: false, actorSynchronized: false }
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
