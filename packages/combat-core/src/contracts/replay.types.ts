import type { Team } from './unit.contracts.js'

export interface CombatVelocityDto {
  x: number
  y: number
}

export interface CombatStatusEffectDto {
  type: string
  duration: number
  value?: number
  sourceId?: string
  tickInterval?: number
  maxStacks?: number
  elapsedTicks?: number
  appliedAtTick?: number
  sourceUnitType?: string
  sourceTeam?: string
  damageType?: string
  sourceUpgradeId?: string
  shieldAmount?: number
}

export interface CombatSnapshotUnit {
  id: string
  team: Team
  type: string
  x: number
  y: number
  hp: number
  maxHp: number
  speed?: number; range?: number; attack?: number; defense?: number; shield?: number; maxShield?: number
  velocity?: CombatVelocityDto; statusEffects?: CombatStatusEffectDto[]
  squadId?: string; squadLeader?: string; currentAngle?: number; initialAngle?: number
  offsetX?: number; offsetY?: number; size?: 'S' | 'M' | 'L' | 'XL'; isFlying?: boolean; isDead?: boolean
  direction?: number; targetId?: string; summonOwnerId?: string; summonSourceId?: string; isTemporary?: boolean
  supportAuras?: Array<{ type: string; [key: string]: unknown }>
  [key: string]: unknown
}

export type CombatReplayUnit = CombatSnapshotUnit

export interface CombatEvent {
  type: string
  unitId?: string
  sourceId?: string
  targetId?: string
  x?: number
  y?: number
  amount?: number
  [key: string]: unknown
}

export const CANONICAL_SNAPSHOT_KEYS = [
  'id', 'team', 'type', 'rank', 'squadId', 'summonSourceId',
  'x', 'y', 'velocity', 'currentAngle', 'initialAngle', 'offsetX', 'offsetY', 'size', 'isFlying',
  'hp', 'maxHp', 'shield', 'maxShield', 'isDead', 'resurrectOnce', 'isTemporary', 'temporaryDuration', 'reassemblyConfig', 'reassemblyState', 'reassemblyTriggersUsed',
  'attack', 'defense', 'speed', 'range', 'actionCooldownMax', 'actionCooldown', 'canTargetAir', 'multishot', 'antiAirDamageMult', 'executeThreshold', 'lifestealMult', 'groundDamageMult', 'shieldDamageMult', 'armorPierceRatio', 'summonCounterDamageMult', 'accuracyPenaltyResist', 'rankScaling',
  'attackType', 'delivery', 'abilityPrograms', 'aoeRadius', 'spawnType', 'spawnCap', 'selfDestructOnAttack', 'statusOnHit', 'markOnHit', 'linePierce', 'coneAttack', 'beamAttack', 'barrageAttack', 'chainAttack', 'splitFire', 'sideWeapon', 'conditionalAttackMode', 'sweepAttack', 'emergeStrikePending', 'appliesEmp', 'leavesPuddle', 'smokeOnAction', 'pullOnHit', 'knockbackOnHit',
  'rampMultiplier', 'chargeDistance', 'aggroLockTicks', 'designatedSquadId', 'meleeSlotIndex', 'targetPriorityProfile', 'conditionalRange', 'controlBeam', 'controlProgress',
  'turnSpeed', 'isMoving', 'isNavigatingObstacle', 'lastProgressX', 'lastProgressY', 'lastTargetDistance', 'stuckTicks', 'avoidanceSide', 'avoidanceTicks', 'damageReductionWhileMoving', 'burrowConfig', 'isBurrowed', 'modeSwitchConfig', 'mobilityMode', 'stanceConfig', 'stanceMode', 'stanceTicks', 'stealthWhileMoving', 'movementStealthActive',
  'statusEffects', 'targetMark', 'stealthUntilAttack', 'hasAttacked', 'transformMode', 'transformState',
  'flatDamageBlock', 'shieldHitBlock', 'shieldHitBlockCharges', 'reactiveArmorCharges', 'reactiveArmorBlock', 'damageShareRadius', 'damageShareRatio', 'damageShareMaxTargets', 'projectileInterceptRadius', 'projectileInterceptCooldownMax', 'projectileInterceptCooldown', 'projectileInterceptMaxDamage',
  'supportAuras', 'supportPrograms', 'periodicAbilities', 'periodicPrograms', 'periodicProgramState', 'fieldEffect', 'formationModifiers',
  'triggerEffects', 'statGrowth', 'attackCharge', 'spawnerConfig', 'replicateOnKill', 'onDeathPuddle',
  'attackTargetId', 'rampTargetId', 'meleeSlotTargetId', 'meleeWaitingTargetId', 'lastProgressTargetId', 'summonOwnerId',
  'direction', 'squadLeader', 'targetId',
] as const

export const CANONICAL_SNAPSHOT_KEY_SET = new Set<string>(CANONICAL_SNAPSHOT_KEYS)

export const CANONICAL_ACTION_KEYS = [
  'unitId', 'type', 'targetId', 'damage', 'isCritical', 'isShieldHit',
  'fromX', 'fromY', 'toX', 'toY', 'facingAngle', 'isWalking', 'motionKind',
  'spawnType', 'spawnTeam', 'spawnMaxHp', 'hazardId', 'radius', 'statusType',
  'sourceUnitId', 'damageKind', 'cause', 'controlMode', 'stanceMode', 'modeState',
  'value', 'markEvent', 'markSquadId', 'markDuration', 'sourceUnitType', 'sourceTeam',
  'retargetCount', 'bonusDamage', 'impactId', 'launchTick', 'earliestLaunchTick',
  'impactTick', 'projectileKind', 'cancelReason',
  'sourceId', 'x', 'y', 'amount', 'details',
] as const

export const CANONICAL_ACTION_KEY_SET = new Set<string>(CANONICAL_ACTION_KEYS)
