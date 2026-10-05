export const ACTION_NUM_KEYS = [
  'x', 'y', 'fromX', 'fromY', 'toX', 'toY', 'amount', 'damage', 'value', 'facingAngle',
  'radius', 'spawnMaxHp', 'markDuration', 'retargetCount', 'bonusDamage', 'launchTick', 'earliestLaunchTick', 'impactTick',
  'impactId',
] as const

export const ACTION_BOOL_KEYS = [
  'isCritical', 'isShieldHit', 'isWalking',
] as const

export const ACTION_STR_KEYS = [
  'unitId', 'sourceId', 'targetId', 'sourceUnitId', 'spawnType', 'spawnTeam', 'hazardId',
  'statusType', 'damageKind', 'cause', 'controlMode', 'stanceMode', 'modeState', 'markEvent',
  'markSquadId', 'sourceUnitType', 'sourceTeam', 'projectileKind', 'cancelReason', 'motionKind',
] as const

export const CANONICAL_ACTION_KEYS = [
  'type', 'details', ...ACTION_NUM_KEYS, ...ACTION_BOOL_KEYS, ...ACTION_STR_KEYS,
] as const

export const CANONICAL_ACTION_KEY_SET = new Set<string>(CANONICAL_ACTION_KEYS)

export const SNAPSHOT_NUM_KEYS = [
  'rank', 'currentAngle', 'initialAngle', 'offsetX', 'offsetY', 'temporaryDuration', 'reassemblyTriggersUsed',
  'attack', 'defense', 'speed', 'range', 'shield', 'maxShield', 'actionCooldownMax', 'actionCooldown', 'multishot',
  'antiAirDamageMult', 'executeThreshold', 'lifestealMult', 'groundDamageMult', 'shieldDamageMult', 'armorPierceRatio',
  'summonCounterDamageMult', 'accuracyPenaltyResist', 'aoeRadius', 'spawnCap', 'rampMultiplier', 'chargeDistance',
  'aggroLockTicks', 'meleeSlotIndex', 'turnSpeed', 'lastProgressX', 'lastProgressY', 'lastTargetDistance',
  'stuckTicks', 'avoidanceSide', 'avoidanceTicks', 'damageReductionWhileMoving', 'stanceTicks',
  'shieldHitBlockCharges', 'reactiveArmorCharges', 'reactiveArmorBlock', 'damageShareRadius', 'damageShareRatio',
  'damageShareMaxTargets', 'projectileInterceptRadius', 'projectileInterceptCooldownMax', 'projectileInterceptCooldown',
  'projectileInterceptMaxDamage', 'direction',
] as const

export const SNAPSHOT_BOOL_KEYS = [
  'isFlying', 'isDead', 'resurrectOnce', 'isTemporary', 'canTargetAir', 'selfDestructOnAttack',
  'appliesEmp', 'leavesPuddle', 'isMoving', 'isNavigatingObstacle', 'isBurrowed', 'stealthWhileMoving',
  'movementStealthActive', 'stealthUntilAttack', 'hasAttacked', 'replicateOnKill',
] as const

export const SNAPSHOT_STR_KEYS = [
  'squadId', 'summonSourceId', 'summonOwnerId', 'squadLeader', 'targetId',
  'attackTargetId', 'rampTargetId', 'designatedSquadId', 'meleeSlotTargetId', 'meleeWaitingTargetId',
  'lastProgressTargetId', 'attackType', 'spawnType', 'targetPriorityProfile',
  'mobilityMode', 'stanceMode', 'onDeathPuddle',
] as const

export const SNAPSHOT_ARR_KEYS = [
  'abilityPrograms', 'statusOnHit', 'conditionalRange', 'transformMode', 'supportPrograms',
  'periodicAbilities', 'periodicPrograms', 'periodicProgramState', 'fieldEffect', 'triggerEffects',
] as const

export const SNAPSHOT_OBJ_KEYS = [
  'reassemblyConfig', 'reassemblyState', 'rankScaling', 'delivery', 'markOnHit', 'linePierce',
  'coneAttack', 'beamAttack', 'barrageAttack', 'chainAttack', 'splitFire', 'sideWeapon',
  'conditionalAttackMode', 'sweepAttack', 'emergeStrikePending', 'smokeOnAction', 'pullOnHit',
  'knockbackOnHit', 'controlBeam', 'controlProgress', 'burrowConfig', 'modeSwitchConfig',
  'stanceConfig', 'transformState', 'flatDamageBlock', 'shieldHitBlock', 'formationModifiers',
  'statGrowth', 'attackCharge', 'spawnerConfig',
] as const

export const CANONICAL_SNAPSHOT_KEYS = [
  'id', 'team', 'type', 'x', 'y', 'hp', 'maxHp', 'size', 'velocity', 'statusEffects', 'targetMark', 'supportAuras',
  ...SNAPSHOT_NUM_KEYS, ...SNAPSHOT_BOOL_KEYS, ...SNAPSHOT_STR_KEYS, ...SNAPSHOT_ARR_KEYS, ...SNAPSHOT_OBJ_KEYS,
] as const

export const CANONICAL_SNAPSHOT_KEY_SET = new Set<string>(CANONICAL_SNAPSHOT_KEYS)

export const CANONICAL_STATUS_EFFECT_KEYS = [
  'type', 'duration', 'value', 'sourceId', 'sourceUnitId', 'stackKey', 'controlMode', 'tickInterval',
  'nextTickIn', 'maxStacks', 'elapsedTicks', 'appliedAtTick', 'sourceUnitType', 'sourceTeam', 'damageType', 'sourceUpgradeId', 'shieldAmount',
] as const

export const CANONICAL_STATUS_EFFECT_KEY_SET = new Set<string>(CANONICAL_STATUS_EFFECT_KEYS)

export const CANONICAL_TARGET_MARK_KEYS = [
  'sourceUnitId', 'squadId', 'duration', 'markDuration', 'damageMultiplier', 'sharedDamage', 'squadWide', 'executeThreshold', 'focusPriority', 'focusRadius', 'retargetPolicy', 'retargetLockTicks',
] as const

export const CANONICAL_TARGET_MARK_KEY_SET = new Set<string>(CANONICAL_TARGET_MARK_KEYS)

export const CANONICAL_SUPPORT_AURA_KEYS = [
  'type', 'radius', 'value', 'duration', 'interval', 'target', 'targetTags',
] as const

export const CANONICAL_SUPPORT_AURA_KEY_SET = new Set<string>(CANONICAL_SUPPORT_AURA_KEYS)

export const CANONICAL_BURROW_CONFIG_KEYS = [
  'damageReduction', 'regenPercentPerTick', 'emergeAttackMult', 'emergeAoeRadiusAdd',
] as const

export const CANONICAL_BURROW_CONFIG_KEY_SET = new Set<string>(CANONICAL_BURROW_CONFIG_KEYS)

export const VELOCITY_KEYS = ['x', 'y'] as const

export const VELOCITY_KEY_SET = new Set<string>(VELOCITY_KEYS)

