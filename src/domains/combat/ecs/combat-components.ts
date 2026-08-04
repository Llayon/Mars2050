import type { SimHazard } from '../combat.sim.types'
import type { UnitRuntimeRules } from '../combat.unit-build.types'
import type { UnitComponentDataMap, UnitField } from '../combat.unit-components'
import { ComponentStore } from './component-store'
import type { EntityId } from './entity'

export type UnitComponentName =
  | 'identity' | 'transform' | 'vitality' | 'combat' | 'weapon'
  | 'targeting' | 'movement' | 'statusControl' | 'defense'
  | 'support' | 'lifecycle'

export type UnitCapabilityName =
  | 'supportAuraCapability' | 'periodicAbilityCapability'
  | 'fieldEffectCapability' | 'formationBonusCapability'
  | 'controlBeamCapability' | 'transformModeCapability'
  | 'growthChargeCapability' | 'burrowRegenerationCapability'
  | 'triggerCapability' | 'reassemblyCapability'
  | 'periodicSpawnerCapability' | 'activeStatusCapability'
  | 'activeControlProgressCapability'

export type ComponentName =
  | 'entityMeta' | UnitComponentName | UnitCapabilityName
  | 'entityTargets' | 'entitySources' | 'runtimeRules' | 'hazard'

export const COMPONENT_FIELDS = {
  identity: ['id', 'team', 'type', 'rank', 'squadId', 'summonSourceId'],
  transform: ['x', 'y', 'velocity', 'currentAngle', 'initialAngle', 'offsetX', 'offsetY', 'size', 'isFlying'],
  vitality: ['hp', 'maxHp', 'shield', 'maxShield', 'isDead', 'resurrectOnce', 'isTemporary', 'temporaryDuration', 'reassemblyConfig', 'reassemblyState', 'reassemblyTriggersUsed'],
  combat: ['attack', 'defense', 'speed', 'range', 'actionCooldownMax', 'actionCooldown', 'canTargetAir', 'multishot', 'antiAirDamageMult', 'executeThreshold', 'lifestealMult', 'groundDamageMult', 'shieldDamageMult', 'armorPierceRatio', 'summonCounterDamageMult', 'accuracyPenaltyResist', 'rankScaling'],
  weapon: ['attackType', 'delivery', 'abilityPrograms', 'aoeRadius', 'spawnType', 'spawnCap', 'selfDestructOnAttack', 'statusOnHit', 'markOnHit', 'linePierce', 'coneAttack', 'beamAttack', 'barrageAttack', 'chainAttack', 'splitFire', 'sideWeapon', 'conditionalAttackMode', 'sweepAttack', 'emergeStrikePending', 'appliesEmp', 'leavesPuddle', 'smokeOnAction', 'pullOnHit', 'knockbackOnHit'],
  targeting: ['rampMultiplier', 'chargeDistance', 'aggroLockTicks', 'designatedSquadId', 'meleeSlotIndex', 'targetPriorityProfile', 'conditionalRange', 'controlBeam', 'controlProgress'],
  movement: ['turnSpeed', 'isMoving', 'isNavigatingObstacle', 'lastProgressX', 'lastProgressY', 'lastTargetDistance', 'stuckTicks', 'avoidanceSide', 'avoidanceTicks', 'damageReductionWhileMoving', 'burrowConfig', 'isBurrowed', 'modeSwitchConfig', 'mobilityMode', 'stanceConfig', 'stanceMode', 'stanceTicks', 'stealthWhileMoving', 'movementStealthActive'],
  statusControl: ['statusEffects', 'targetMark', 'stealthUntilAttack', 'hasAttacked', 'transformMode', 'transformState'],
  defense: ['flatDamageBlock', 'shieldHitBlock', 'shieldHitBlockCharges', 'reactiveArmorCharges', 'reactiveArmorBlock', 'damageShareRadius', 'damageShareRatio', 'damageShareMaxTargets', 'projectileInterceptRadius', 'projectileInterceptCooldownMax', 'projectileInterceptCooldown', 'projectileInterceptMaxDamage'],
  support: ['supportAuras', 'supportPrograms', 'periodicAbilities', 'periodicPrograms', 'periodicProgramState', 'fieldEffect', 'formationModifiers'],
  lifecycle: ['triggerEffects', 'statGrowth', 'attackCharge', 'spawnerConfig', 'replicateOnKill', 'onDeathPuddle'],
} as const satisfies { [Name in UnitComponentName]: readonly (keyof UnitComponentDataMap[Name])[] }

type MissingComponentField = {
  [Name in UnitComponentName]:
    Exclude<keyof UnitComponentDataMap[Name], typeof COMPONENT_FIELDS[Name][number]>
}[UnitComponentName]

export const COMPONENT_FIELDS_ARE_EXHAUSTIVE:
  MissingComponentField extends never ? true : never = true

export interface EntityMetaComponent {
  kind: 'unit' | 'hazard'
  externalId: string
}

export interface EntityTargetRefsComponent {
  attackTarget?: EntityId
  rampTarget?: EntityId
  meleeTarget?: EntityId
  meleeWaitingTarget?: EntityId
  progressTarget?: EntityId
  summonOwner?: EntityId
}

export interface UnitCapabilityComponent {
  readonly present: true
}

export interface EntitySourceRefsComponent {
  statusSources: Record<string, EntityId>
  targetMarkSource?: EntityId
  controlProgressSource?: EntityId
  hazardSource?: EntityId
}

export interface CombatComponentMap {
  entityMeta: EntityMetaComponent
  identity: UnitComponentDataMap['identity']
  transform: UnitComponentDataMap['transform']
  vitality: UnitComponentDataMap['vitality']
  combat: UnitComponentDataMap['combat']
  weapon: UnitComponentDataMap['weapon']
  targeting: UnitComponentDataMap['targeting']
  movement: UnitComponentDataMap['movement']
  statusControl: UnitComponentDataMap['statusControl']
  defense: UnitComponentDataMap['defense']
  support: UnitComponentDataMap['support']
  lifecycle: UnitComponentDataMap['lifecycle']
  runtimeRules: UnitRuntimeRules
  supportAuraCapability: UnitCapabilityComponent
  periodicAbilityCapability: UnitCapabilityComponent
  fieldEffectCapability: UnitCapabilityComponent
  formationBonusCapability: UnitCapabilityComponent
  controlBeamCapability: UnitCapabilityComponent
  transformModeCapability: UnitCapabilityComponent
  growthChargeCapability: UnitCapabilityComponent
  burrowRegenerationCapability: UnitCapabilityComponent
  triggerCapability: UnitCapabilityComponent
  reassemblyCapability: UnitCapabilityComponent
  periodicSpawnerCapability: UnitCapabilityComponent
  activeStatusCapability: UnitCapabilityComponent
  activeControlProgressCapability: UnitCapabilityComponent
  entityTargets: EntityTargetRefsComponent
  entitySources: EntitySourceRefsComponent
  hazard: SimHazard
}

export type CombatComponentStores = {
  [Name in ComponentName]: ComponentStore<CombatComponentMap[Name]>
}

export const FIELD_COMPONENT = new Map<UnitField, ComponentName>(
  [
    ...Object.entries(COMPONENT_FIELDS).flatMap(([name, fields]) =>
    fields.map(field => [field, name as ComponentName] as const),
    ),
    ...([
      'attackTargetId', 'rampTargetId', 'meleeSlotTargetId',
      'meleeWaitingTargetId', 'lastProgressTargetId', 'summonOwnerId',
    ] as const).map(field => [field, 'entityTargets'] as const),
  ],
)
FIELD_COMPONENT.set('runtimeRules', 'runtimeRules')

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
    runtimeRules: new ComponentStore<CombatComponentMap['runtimeRules']>(),
    supportAuraCapability: new ComponentStore<CombatComponentMap['supportAuraCapability']>(),
    periodicAbilityCapability: new ComponentStore<CombatComponentMap['periodicAbilityCapability']>(),
    fieldEffectCapability: new ComponentStore<CombatComponentMap['fieldEffectCapability']>(),
    formationBonusCapability: new ComponentStore<CombatComponentMap['formationBonusCapability']>(),
    controlBeamCapability: new ComponentStore<CombatComponentMap['controlBeamCapability']>(),
    transformModeCapability: new ComponentStore<CombatComponentMap['transformModeCapability']>(),
    growthChargeCapability: new ComponentStore<CombatComponentMap['growthChargeCapability']>(),
    burrowRegenerationCapability: new ComponentStore<CombatComponentMap['burrowRegenerationCapability']>(),
    triggerCapability: new ComponentStore<CombatComponentMap['triggerCapability']>(),
    reassemblyCapability: new ComponentStore<CombatComponentMap['reassemblyCapability']>(),
    periodicSpawnerCapability: new ComponentStore<CombatComponentMap['periodicSpawnerCapability']>(),
    activeStatusCapability: new ComponentStore<CombatComponentMap['activeStatusCapability']>(),
    activeControlProgressCapability: new ComponentStore<CombatComponentMap['activeControlProgressCapability']>(),
    entityTargets: new ComponentStore<CombatComponentMap['entityTargets']>(),
    entitySources: new ComponentStore<CombatComponentMap['entitySources']>(),
    hazard: new ComponentStore<CombatComponentMap['hazard']>(),
  }
}
