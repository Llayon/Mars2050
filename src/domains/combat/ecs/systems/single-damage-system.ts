import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { RuntimeActionResult } from '../../combat.runtime'
import type { UnitTypeKey } from '../../combat.types'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsEffectiveActionRange } from '../movement-positioning'
import { applyEcsSingleDamage } from './damage-system'
import { canResolveSimpleEcsDeath, resolveSimpleEcsDeath } from './death-system'
import { getEcsShareRecipients } from './damage-sharing-system'
import { applyEcsPrimaryDamageModifiers } from './primary-damage-modifier-system'

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
  if (weapon.attackType !== 'single' || combat.range <= 60 || (combat.multishot ?? 1) !== 1) return false
  if (hasUnsupportedStatuses(status.statusEffects, true) || hasUnsupportedStatuses(targetStatus.statusEffects, false)) return false
  if (!canResolveSimpleEcsDeath(world, targetId)) return false
  if (movement.stanceConfig || movement.modeSwitchConfig || movement.burrowConfig || movement.stealthWhileMoving) return false
  if (
    targeting.conditionalRange?.length ||
    config?.minimumRange || config?.onKill
  ) return false
  if (hasWeaponPrimitives(weapon)) return false
  if (hasLifecyclePrimitives(lifecycle) || hasLifecyclePrimitives(targetLifecycle)) return false
  return getEcsShareRecipients(world, targetId).every(recipientId => canResolveSimpleEcsDeath(world, recipientId))
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
  if (edgeDistance > getEcsEffectiveActionRange(world, entityId)) return notActed()
  const targetAngle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x)
  if (Math.abs(normalizeAngle(targetAngle - transform.currentAngle)) > FACING_TOLERANCE) return notActed()
  if (combat.actionCooldown > 0) return notActed()

  combat.actionCooldown = getSuppressedCooldown(combat.actionCooldownMax, status.statusEffects)
  actions.push({ unitId: identity.id, type: 'attack', targetId: world.stores.identity.require(targetId).id })
  const primaryDamage = applyEcsPrimaryDamageModifiers(world, entityId, targetId, combat.attack, actions)
  applyEcsSingleDamage(world, entityId, targetId, primaryDamage, actions)
  status.hasAttacked = true
  resolveSimpleEcsDeath(world, targetId, entityId, actions)
  world.syncComponentsFromStore(entityId, ['vitality', 'combat', 'targeting', 'statusControl'])
  world.syncComponentsFromStore(targetId, ['vitality', 'defense'])
  return { acted: true, actorSynchronized: true }
}

function hasWeaponPrimitives(weapon: ReturnType<CombatWorld['stores']['weapon']['require']>): boolean {
  return Boolean(
    weapon.aoeRadius || weapon.statusOnHit?.length || weapon.markOnHit ||
    weapon.linePierce || weapon.coneAttack || weapon.beamAttack ||
    weapon.barrageAttack || weapon.chainAttack || weapon.splitFire ||
    weapon.sideWeapon || weapon.conditionalAttackMode || weapon.sweepAttack ||
    weapon.emergeStrikePending || weapon.appliesEmp || weapon.leavesPuddle ||
    weapon.smokeOnAction || weapon.pullOnHit || weapon.knockbackOnHit,
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
  const supported = attacker
    ? new Set(['attack_boost', 'output_suppressed', 'accuracy_reduced', 'range_boost', 'range_suppressed', 'haste'])
    : new Set(['armor_broken', 'vulnerable', 'damage_reduction', 'revealed'])
  return effects.some(effect => effect.duration > 0 && !supported.has(effect.type))
}

function getSuppressedCooldown(
  baseCooldown: number,
  effects: ReturnType<CombatWorld['stores']['statusControl']['require']>['statusEffects'],
): number {
  let suppression = 0
  for (const effect of effects) {
    if (effect.type === 'output_suppressed' && effect.duration > 0 && effect.value && effect.value > 0) {
      suppression += effect.value <= 1 ? effect.value : effect.value / 100
    }
  }
  const base = Math.max(1, Math.round(baseCooldown))
  return Math.max(1, Math.round(base * (1 + Math.min(0.5, suppression))))
}

function notActed(): RuntimeActionResult {
  return { acted: false, actorSynchronized: false }
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
