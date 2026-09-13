import type { BattleAction } from '../../combat.actions.js'
import { chooseHackControlMode } from '../../combat.control-mode.js'
import type { HackControlMode, RuntimeStatusEffect } from '../../combat.primitives.js'
import type { RuntimeActionResult } from '../../combat.runtime.js'
import { getDistance, getSizeRadius, type PRNG } from '../../combat.utils.js'
import type { CombatWorld } from '../combat-world.js'
import type { EntityId } from '../entity.js'
import { getEcsEffectiveActionRange } from '../movement-positioning.js'
import { canUseEcsDirectionalGeometry } from './directional-geometry-system.js'
import { canUseEcsRadialAoe } from './radial-aoe-system.js'
import { canUseEcsSplitFire } from './split-fire-system.js'
import { canUseEcsChainAttack } from './chain-attack-system.js'
import { canUseEcsSideWeapon } from './side-weapon-system.js'
import { canUseEcsDisplacement } from './displacement-system.js'
import { canUseEcsSweepAttack } from './sweep-attack-system.js'
import { canUseEcsConditionalAttack } from './conditional-attack-system.js'
import { canUseEcsBarrageAttack } from './barrage-attack-system.js'
import { syncEcsBurrowForAction } from './emerge-strike-system.js'
import { resolveEcsSingleShot } from './single-shot-system.js'
import {
  getEcsActionCooldown,
  isEcsWeaponActionInRange,
  prepareEcsStanceForAction,
  syncEcsModeForAction,
} from './action-setup.js'

const FACING_TOLERANCE = 0.26

export function canUseSimpleSingleDamage(world: CombatWorld, entityId: EntityId, targetId: EntityId): boolean {
  const weapon = world.stores.weapon.require(entityId)
  if (weapon.delivery && weapon.delivery.kind !== 'instant') return false
  if (!['single', 'aoe'].includes(weapon.attackType)) return false
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
  options: { allowDeadActorAction?: boolean } = {},
): RuntimeActionResult {
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
  if (isActionBlocked(status.statusEffects, combat.attack)) return notActed()
  if (!prepareEcsStanceForAction(world, entityId, actions)) {
    return { acted: true }
  }

  syncEcsModeForAction(world, entityId, actions)
  syncEcsBurrowForAction(world, entityId, actions)
  combat.actionCooldown = getEcsActionCooldown(world, entityId)
  const shots = combat.multishot || 1
  for (let shot = 0; shot < shots; shot++) {
    if (world.stores.vitality.require(entityId).isDead && !options.allowDeadActorAction) break
    if (world.stores.vitality.require(targetId).isDead && !options.allowDeadActorAction) break
    resolveEcsSingleShot(world, entityId, targetId, actions, tick, rng)
  }
  return { acted: true }
}

function isActionBlocked(effects: RuntimeStatusEffect[], attack: number): boolean {
  let hackMode: HackControlMode | undefined
  for (const effect of effects) {
    if (effect.duration <= 0) continue
    if (effect.type === 'emp') return true
    if (effect.type === 'hacked') {
      hackMode = chooseHackControlMode(
        hackMode,
        effect.controlMode ?? 'disable',
      )
    }
  }
  return hackMode === 'disable' || (hackMode !== undefined && attack <= 0)
}

function notActed(): RuntimeActionResult {
  return { acted: false }
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
