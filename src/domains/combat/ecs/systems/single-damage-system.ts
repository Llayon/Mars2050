import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { RuntimeActionResult } from '../../combat.runtime'
import type { UnitTypeKey } from '../../combat.types'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsEffectiveActionRange } from '../movement-positioning'
import { breakEcsMovementStealthOnAttack } from '../movement-state'
import { applyEcsSingleDamage } from './damage-system'
import { canResolveSimpleEcsDeath, resolveSimpleEcsDeath } from './death-system'
import { getEcsShareRecipients } from './damage-sharing-system'
import { applyEcsPrimaryDamageModifiers } from './primary-damage-modifier-system'
import { applyEcsOnHitEffects } from './on-hit-system'
import { applyEcsDirectionalGeometry, canUseEcsDirectionalGeometry } from './directional-geometry-system'
import { applyEcsRadialAoe, canUseEcsRadialAoe } from './radial-aoe-system'
import { applyEcsSplitFire, canUseEcsSplitFire } from './split-fire-system'
import { applyEcsChainAttack, canUseEcsChainAttack } from './chain-attack-system'
import { applyEcsSideWeapon, canUseEcsSideWeapon } from './side-weapon-system'
import { applyEcsDisplacement, canUseEcsDisplacement } from './displacement-system'
import { applyEcsSweepAttack, canUseEcsSweepAttack } from './sweep-attack-system'
import { applyEcsConditionalAttack, canUseEcsConditionalAttack } from './conditional-attack-system'
import { applyEcsBarrageAttack, canUseEcsBarrageAttack } from './barrage-attack-system'
import {
  consumeEcsEmergeStrike,
  syncEcsBurrowForAction,
} from './emerge-strike-system'
import {
  getEcsActionCooldown,
  isEcsWeaponActionInRange,
  prepareEcsStanceForAction,
  syncEcsModeForAction,
} from './action-setup'

const FACING_TOLERANCE = 0.26

export function canUseSimpleSingleDamage(world: CombatWorld, entityId: EntityId, targetId: EntityId): boolean {
  const identity = world.stores.identity.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const targeting = world.stores.targeting.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const targetStatus = world.stores.statusControl.require(targetId)
  const lifecycle = world.stores.lifecycle.require(entityId)
  const targetLifecycle = world.stores.lifecycle.require(targetId)
  const config = UNIT_TYPES[identity.type as UnitTypeKey]?.baseStats
  if (!['single', 'aoe'].includes(weapon.attackType) || (combat.multishot ?? 1) !== 1) return false
  if (hasUnsupportedStatuses(status.statusEffects, true) || hasUnsupportedStatuses(targetStatus.statusEffects, false)) return false
  if (!canResolveSimpleEcsDeath(world, targetId)) return false
  if (
    targeting.conditionalRange?.length ||
    config?.onKill
  ) return false
  if (hasWeaponPrimitives(weapon)) return false
  if (hasLifecyclePrimitives(lifecycle) || hasLifecyclePrimitives(targetLifecycle)) return false
  return getEcsShareRecipients(world, targetId).every(recipientId =>
    canResolveSimpleEcsDeath(world, recipientId),
  ) && canUseEcsDirectionalGeometry(world, entityId, targetId) &&
    canUseEcsBarrageAttack(world, entityId, targetId) &&
    canUseEcsChainAttack(world, entityId, targetId) &&
    canUseEcsSplitFire(world, entityId, targetId) &&
    canUseEcsSideWeapon(world, entityId, targetId) &&
    canUseEcsConditionalAttack(world, entityId, targetId) &&
    canUseEcsSweepAttack(world, entityId, targetId) &&
    canUseEcsRadialAoe(world, entityId, targetId) &&
    canUseEcsDisplacement(world, entityId)
}

export function runSimpleSingleDamage(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
): RuntimeActionResult {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const targetTransform = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const edgeDistance = getDistance(transform.x, transform.y, targetTransform.x, targetTransform.y) -
    getSizeRadius(transform.size) - getSizeRadius(targetTransform.size)
  if (!isEcsWeaponActionInRange(world, entityId, targetId, edgeDistance)) return notActed()
  const targetAngle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x)
  if (Math.abs(normalizeAngle(targetAngle - transform.currentAngle)) > FACING_TOLERANCE) return notActed()
  if (combat.actionCooldown > 0) return notActed()
  if (!prepareEcsStanceForAction(world, entityId, actions)) {
    world.syncComponentsFromStore(entityId, ['movement'])
    return { acted: true, actorSynchronized: true }
  }

  syncEcsModeForAction(world, entityId, actions)
  syncEcsBurrowForAction(world, entityId, actions)
  combat.actionCooldown = getEcsActionCooldown(world, entityId)
  actions.push({ unitId: identity.id, type: 'attack', targetId: world.stores.identity.require(targetId).id })
  const emergeStrike = consumeEcsEmergeStrike(world, entityId)
  let primaryDamage = applyEcsPrimaryDamageModifiers(world, entityId, targetId, combat.attack, actions)
  if (emergeStrike?.attackMult) primaryDamage = Math.floor(primaryDamage * emergeStrike.attackMult)
  const damageResult = applyEcsSingleDamage(world, entityId, targetId, primaryDamage, actions)
  status.hasAttacked = true
  breakEcsMovementStealthOnAttack(world, entityId, actions)
  if (!damageResult.intercepted) applyEcsOnHitEffects(world, entityId, targetId, actions)
  resolveSimpleEcsDeath(world, targetId, entityId, actions)
  if (!damageResult.intercepted) applyEcsDirectionalGeometry(world, entityId, targetId, actions)
  if (!damageResult.intercepted) applyEcsBarrageAttack(world, entityId, targetId, actions)
  if (!damageResult.intercepted) applyEcsChainAttack(world, entityId, targetId, actions)
  if (!damageResult.intercepted) applyEcsSplitFire(world, entityId, targetId, actions)
  if (!damageResult.intercepted) applyEcsSideWeapon(world, entityId, targetId, actions)
  if (!damageResult.intercepted) applyEcsConditionalAttack(world, entityId, targetId, actions)
  if (!damageResult.intercepted) applyEcsSweepAttack(world, entityId, targetId, actions)
  if (!damageResult.intercepted) {
    applyEcsRadialAoe(world, entityId, targetId, actions, emergeStrike?.aoeRadiusAdd)
  }
  if (!damageResult.intercepted) applyEcsDisplacement(world, entityId, targetId, actions)
  world.syncComponentsFromStore(entityId, ['transform', 'vitality', 'combat', 'weapon', 'targeting', 'statusControl', 'movement'])
  world.syncComponentsFromStore(targetId, ['vitality', 'defense'])
  return { acted: true, actorSynchronized: true }
}

function hasWeaponPrimitives(weapon: ReturnType<CombatWorld['stores']['weapon']['require']>): boolean {
  return Boolean(
    weapon.leavesPuddle || weapon.smokeOnAction,
  )
}

function hasLifecyclePrimitives(lifecycle: ReturnType<CombatWorld['stores']['lifecycle']['require']>): boolean {
  return Boolean(
    lifecycle.triggerEffects?.length || lifecycle.attackCharge ||
    lifecycle.replicateOnKill || lifecycle.onDeathPuddle,
  )
}

function hasUnsupportedStatuses(
  effects: ReturnType<CombatWorld['stores']['statusControl']['require']>['statusEffects'],
  attacker: boolean,
): boolean {
  return effects.some(effect => effect.duration > 0 &&
    (effect.type === 'hacked' || (attacker && effect.type === 'emp')))
}

function notActed(): RuntimeActionResult {
  return { acted: false, actorSynchronized: false }
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
