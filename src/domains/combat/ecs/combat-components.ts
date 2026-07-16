import type { SimUnit } from '../combat.sim.types'
import { ComponentStore } from './component-store'

export type ComponentName =
  | 'identity' | 'transform' | 'vitality' | 'combat' | 'weapon'
  | 'targeting' | 'movement' | 'statusControl' | 'defense'
  | 'support' | 'lifecycle' | 'mechanics'

export type ComponentData = Partial<SimUnit>

export const COMPONENT_FIELDS: Record<Exclude<ComponentName, 'mechanics'>, readonly (keyof SimUnit)[]> = {
  identity: ['id', 'team', 'type', 'rank', 'squadId', 'summonOwnerId', 'summonSourceId'],
  transform: ['x', 'y', 'velocity', 'currentAngle', 'initialAngle', 'offsetX', 'offsetY', 'size', 'isFlying'],
  vitality: ['hp', 'maxHp', 'shield', 'maxShield', 'isDead', 'resurrectOnce', 'isTemporary', 'temporaryDuration', 'reassemblyConfig', 'reassemblyState', 'reassemblyTriggersUsed'],
  combat: ['attack', 'defense', 'speed', 'range', 'actionCooldownMax', 'actionCooldown', 'canTargetAir', 'multishot', 'antiAirDamageMult', 'executeThreshold', 'lifestealMult', 'groundDamageMult', 'shieldDamageMult', 'armorPierceRatio', 'summonCounterDamageMult', 'accuracyPenaltyResist', 'rankScaling'],
  weapon: ['attackType', 'aoeRadius', 'spawnType', 'spawnCap', 'statusOnHit', 'markOnHit', 'linePierce', 'coneAttack', 'beamAttack', 'barrageAttack', 'chainAttack', 'splitFire', 'sideWeapon', 'conditionalAttackMode', 'sweepAttack', 'emergeStrikePending', 'appliesEmp', 'leavesPuddle', 'smokeOnAction', 'pullOnHit', 'knockbackOnHit'],
  targeting: ['attackTargetId', 'rampTargetId', 'rampMultiplier', 'chargeDistance', 'aggroLockTicks', 'meleeSlotTargetId', 'meleeSlotIndex', 'meleeWaitingTargetId', 'targetPriorityProfile', 'conditionalRange', 'controlBeam', 'controlProgress'],
  movement: ['turnSpeed', 'isMoving', 'isNavigatingObstacle', 'lastProgressX', 'lastProgressY', 'lastTargetDistance', 'lastProgressTargetId', 'stuckTicks', 'avoidanceSide', 'avoidanceTicks', 'damageReductionWhileMoving', 'burrowConfig', 'isBurrowed', 'modeSwitchConfig', 'mobilityMode', 'stanceConfig', 'stanceMode', 'stanceTicks', 'stealthWhileMoving', 'movementStealthActive'],
  statusControl: ['statusEffects', 'targetMark', 'stealthUntilAttack', 'hasAttacked', 'transformMode', 'transformState'],
  defense: ['flatDamageBlock', 'shieldHitBlock', 'shieldHitBlockCharges', 'reactiveArmorCharges', 'reactiveArmorBlock', 'damageShareRadius', 'damageShareRatio', 'damageShareMaxTargets', 'projectileInterceptRadius', 'projectileInterceptCooldownMax', 'projectileInterceptCooldown', 'projectileInterceptMaxDamage'],
  support: ['supportAuras', 'periodicAbilities', 'fieldEffect', 'formationModifiers'],
  lifecycle: ['triggerEffects', 'statGrowth', 'attackCharge', 'spawnerConfig', 'replicateOnKill', 'onDeathPuddle'],
}

export const FIELD_COMPONENT = new Map<keyof SimUnit, ComponentName>(
  Object.entries(COMPONENT_FIELDS).flatMap(([name, fields]) =>
    fields.map(field => [field, name as ComponentName] as const),
  ),
)

export function createComponentStores(): Record<ComponentName, ComponentStore<ComponentData>> {
  return {
    identity: new ComponentStore(), transform: new ComponentStore(), vitality: new ComponentStore(),
    combat: new ComponentStore(), weapon: new ComponentStore(), targeting: new ComponentStore(),
    movement: new ComponentStore(), statusControl: new ComponentStore(), defense: new ComponentStore(),
    support: new ComponentStore(), lifecycle: new ComponentStore(), mechanics: new ComponentStore(),
  }
}
