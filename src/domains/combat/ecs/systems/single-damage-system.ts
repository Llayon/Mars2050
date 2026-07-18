import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { RuntimeActionResult } from '../../combat.runtime'
import type { UnitTypeKey } from '../../combat.types'
import { getDistance, getSizeRadius, type PRNG } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsEffectiveActionRange } from '../movement-positioning'
import { canResolveSimpleEcsDeath } from './death-system'
import { getEcsShareRecipients } from './damage-sharing-system'
import { canUseEcsDirectionalGeometry } from './directional-geometry-system'
import { canUseEcsRadialAoe } from './radial-aoe-system'
import { canUseEcsSplitFire } from './split-fire-system'
import { canUseEcsChainAttack } from './chain-attack-system'
import { canUseEcsSideWeapon } from './side-weapon-system'
import { canUseEcsDisplacement } from './displacement-system'
import { canUseEcsSweepAttack } from './sweep-attack-system'
import { canUseEcsConditionalAttack } from './conditional-attack-system'
import { canUseEcsBarrageAttack } from './barrage-attack-system'
import { syncEcsBurrowForAction } from './emerge-strike-system'
import { resolveEcsSingleShot } from './single-shot-system'
import {
  getEcsActionCooldown,
  isEcsWeaponActionInRange,
  prepareEcsStanceForAction,
  syncEcsModeForAction,
} from './action-setup'

const FACING_TOLERANCE = 0.26

export function canUseSimpleSingleDamage(world: CombatWorld, entityId: EntityId, targetId: EntityId): boolean {
  const identity = world.stores.identity.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const targeting = world.stores.targeting.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const targetStatus = world.stores.statusControl.require(targetId)
  const lifecycle = world.stores.lifecycle.require(entityId)
  const targetLifecycle = world.stores.lifecycle.require(targetId)
  const config = UNIT_TYPES[identity.type as UnitTypeKey]?.baseStats
  if (!['single', 'aoe'].includes(weapon.attackType)) return false
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
  tick: number,
  rng: PRNG,
): RuntimeActionResult {
  const transform = world.stores.transform.require(entityId)
  const targetTransform = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
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
  const shots = combat.multishot || 1
  for (let shot = 0; shot < shots; shot++) {
    if (world.stores.vitality.require(targetId).isDead) break
    resolveEcsSingleShot(world, entityId, targetId, actions, tick, rng)
  }
  world.syncComponentsFromStore(entityId, ['transform', 'vitality', 'combat', 'weapon', 'targeting', 'statusControl', 'movement', 'lifecycle'])
  world.syncComponentsFromStore(targetId, ['vitality', 'defense'])
  return { acted: true, actorSynchronized: true }
}

function hasWeaponPrimitives(weapon: ReturnType<CombatWorld['stores']['weapon']['require']>): boolean {
  return Boolean(
    weapon.smokeOnAction,
  )
}

function hasLifecyclePrimitives(lifecycle: ReturnType<CombatWorld['stores']['lifecycle']['require']>): boolean {
  return Boolean(
    lifecycle.triggerEffects?.length || lifecycle.replicateOnKill ||
    lifecycle.onDeathPuddle,
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
