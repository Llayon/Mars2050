import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { RuntimeActionResult } from '../../combat.runtime'
import type { UnitTypeKey } from '../../combat.types'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsEffectiveActionRange } from '../movement-positioning'
import { resolveSimpleEcsDeath } from './death-system'

const FACING_TOLERANCE = 0.26

export function canUseSimpleSingleDamage(world: CombatWorld, entityId: EntityId, targetId: EntityId): boolean {
  const identity = world.stores.identity.require(entityId)
  const targetIdentity = world.stores.identity.require(targetId)
  const vitality = world.stores.vitality.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const targeting = world.stores.targeting.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const targetStatus = world.stores.statusControl.require(targetId)
  const defense = world.stores.defense.require(targetId)
  const lifecycle = world.stores.lifecycle.require(entityId)
  const targetLifecycle = world.stores.lifecycle.require(targetId)
  const config = UNIT_TYPES[identity.type as UnitTypeKey]?.baseStats
  if (weapon.attackType !== 'single' || combat.range <= 60 || (combat.multishot ?? 1) !== 1) return false
  if (world.hazards.length > 0 || hasProjectileInterceptor(world)) return false
  if (identity.rank && identity.rank > 1 || targetIdentity.rank && targetIdentity.rank > 1) return false
  if (status.statusEffects.length > 0 || targetStatus.statusEffects.length > 0 || targetStatus.targetMark) return false
  if (vitality.shield > 0 || vitality.resurrectOnce || vitality.reassemblyConfig) return false
  if (movement.stanceConfig || movement.modeSwitchConfig || movement.burrowConfig || movement.stealthWhileMoving) return false
  if (targeting.conditionalRange?.length || config?.minimumRange || config?.percentHpDamage || config?.onKill) return false
  if (hasCombatModifiers(combat) || hasWeaponPrimitives(weapon) || hasDefensePrimitives(defense)) return false
  if (hasLifecyclePrimitives(lifecycle) || hasLifecyclePrimitives(targetLifecycle)) return false
  const targetMovement = world.stores.movement.require(targetId)
  return !targetMovement.damageReductionWhileMoving && !targetMovement.isBurrowed
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
  const targetCombat = world.stores.combat.require(targetId)
  const targetVitality = world.stores.vitality.require(targetId)
  const status = world.stores.statusControl.require(entityId)
  const edgeDistance = getDistance(transform.x, transform.y, targetTransform.x, targetTransform.y) -
    getSizeRadius(transform.size) - getSizeRadius(targetTransform.size)
  if (edgeDistance > getEcsEffectiveActionRange(world, entityId)) return notActed()
  const targetAngle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x)
  if (Math.abs(normalizeAngle(targetAngle - transform.currentAngle)) > FACING_TOLERANCE) return notActed()
  if (combat.actionCooldown > 0) return notActed()

  combat.actionCooldown = combat.actionCooldownMax
  actions.push({ unitId: identity.id, type: 'attack', targetId: world.stores.identity.require(targetId).id })
  const damage = Math.max(1, Math.floor(combat.attack) - Math.floor(Math.max(0, targetCombat.defense)))
  targetVitality.hp -= damage
  actions.push({ unitId: identity.id, type: 'damage', targetId: world.stores.identity.require(targetId).id, damage })
  status.hasAttacked = true
  resolveSimpleEcsDeath(world, targetId, entityId, actions)
  world.syncComponentsFromStore(entityId, ['combat', 'statusControl'])
  world.syncComponentsFromStore(targetId, ['vitality'])
  return { acted: true, actorSynchronized: true }
}

function hasCombatModifiers(combat: ReturnType<CombatWorld['stores']['combat']['require']>): boolean {
  return Boolean(
    combat.antiAirDamageMult || combat.executeThreshold || combat.lifestealMult ||
    combat.armorPierceRatio || combat.summonCounterDamageMult ||
    combat.accuracyPenaltyResist || combat.rankScaling ||
    (combat.groundDamageMult !== undefined && combat.groundDamageMult !== 1) ||
    (combat.shieldDamageMult !== undefined && combat.shieldDamageMult !== 1),
  )
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

function hasDefensePrimitives(defense: ReturnType<CombatWorld['stores']['defense']['require']>): boolean {
  return Boolean(
    defense.flatDamageBlock || defense.shieldHitBlock ||
    defense.reactiveArmorCharges || defense.damageShareRadius ||
    defense.projectileInterceptRadius,
  )
}

function hasLifecyclePrimitives(lifecycle: ReturnType<CombatWorld['stores']['lifecycle']['require']>): boolean {
  return Boolean(
    lifecycle.triggerEffects?.length || lifecycle.attackCharge ||
    lifecycle.replicateOnKill || lifecycle.onDeathPuddle,
  )
}

function hasProjectileInterceptor(world: CombatWorld): boolean {
  return world.query(['defense']).some(entityId => {
    const defense = world.stores.defense.require(entityId)
    return Boolean(defense.projectileInterceptRadius && (defense.projectileInterceptCooldown ?? 0) <= 0)
  })
}

function notActed(): RuntimeActionResult {
  return { acted: false, actorSynchronized: false }
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
