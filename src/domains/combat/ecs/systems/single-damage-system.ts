import type { BattleAction } from '../../combat.actions'
import type { RuntimeActionResult } from '../../combat.runtime'
import { getDistance, getSizeRadius, type PRNG } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsEffectiveActionRange } from '../movement-positioning'
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
  const weapon = world.stores.weapon.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const targetStatus = world.stores.statusControl.require(targetId)
  if (!['single', 'aoe'].includes(weapon.attackType)) return false
  if (hasUnsupportedStatuses(status.statusEffects, true) || hasUnsupportedStatuses(targetStatus.statusEffects, false)) return false
  return canUseEcsDirectionalGeometry(world, entityId, targetId) &&
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
  world.syncComponentsFromStore(targetId, [
    'vitality',
    'defense',
    'combat',
    'statusControl',
    'movement',
    'lifecycle',
  ])
  return { acted: true, actorSynchronized: true }
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
