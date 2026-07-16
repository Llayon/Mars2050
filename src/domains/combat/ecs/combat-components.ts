import type { SimHazard, SimUnit } from '../combat.sim.types'
import { ComponentStore } from './component-store'

export type UnitComponentName =
  | 'identity' | 'transform' | 'vitality' | 'combat' | 'weapon'
  | 'targeting' | 'movement' | 'statusControl' | 'defense'
  | 'support' | 'lifecycle'

export type ComponentName = 'entityMeta' | UnitComponentName | 'hazard'

export const COMPONENT_FIELDS = {
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
} as const satisfies Record<UnitComponentName, readonly (keyof SimUnit)[]>

type ComponentFrom<Name extends UnitComponentName> = Pick<SimUnit, typeof COMPONENT_FIELDS[Name][number]>

export interface EntityMetaComponent {
  kind: 'unit' | 'hazard'
  externalId: string
}

export interface CombatComponentMap {
  entityMeta: EntityMetaComponent
  identity: ComponentFrom<'identity'>
  transform: ComponentFrom<'transform'>
  vitality: ComponentFrom<'vitality'>
  combat: ComponentFrom<'combat'>
  weapon: ComponentFrom<'weapon'>
  targeting: ComponentFrom<'targeting'>
  movement: ComponentFrom<'movement'>
  statusControl: ComponentFrom<'statusControl'>
  defense: ComponentFrom<'defense'>
  support: ComponentFrom<'support'>
  lifecycle: ComponentFrom<'lifecycle'>
  hazard: SimHazard
}

export type CombatComponentStores = {
  [Name in ComponentName]: ComponentStore<CombatComponentMap[Name]>
}

export const FIELD_COMPONENT = new Map<keyof SimUnit, ComponentName>(
  Object.entries(COMPONENT_FIELDS).flatMap(([name, fields]) =>
    fields.map(field => [field, name as ComponentName] as const),
  ),
)

export function createComponentStores(): CombatComponentStores {
  return {
    entityMeta: new ComponentStore<CombatComponentMap['entityMeta']>(),
    identity: new ComponentStore<CombatComponentMap['identity']>(),
    transform: new ComponentStore<CombatComponentMap['transform']>(),
    vitality: new ComponentStore<CombatComponentMap['vitality']>(),
    combat: new ComponentStore<CombatComponentMap['combat']>(),
    weapon: new ComponentStore<CombatComponentMap['weapon']>(),
    targeting: new ComponentStore<CombatComponentMap['targeting']>(),
    movement: new ComponentStore<CombatComponentMap['movement']>(),
    statusControl: new ComponentStore<CombatComponentMap['statusControl']>(),
    defense: new ComponentStore<CombatComponentMap['defense']>(),
    support: new ComponentStore<CombatComponentMap['support']>(),
    lifecycle: new ComponentStore<CombatComponentMap['lifecycle']>(),
    hazard: new ComponentStore<CombatComponentMap['hazard']>(),
  }
}
