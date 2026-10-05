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

export const SNAPSHOT_OBJ_ALLOWED_KEY_SETS: Record<string, Set<string>> = {
  linePierce: new Set(['width', 'damageMultiplier', 'maxTargets']),
  coneAttack: new Set(['angleDeg', 'damageMultiplier', 'maxTargets']),
  beamAttack: new Set(['width', 'damageMultiplier', 'maxTargets']),
  barrageAttack: new Set(['impacts', 'radius', 'spreadRadius', 'damageMultiplier', 'maxTargetsPerImpact', 'impactIntervalTicks']),
  chainAttack: new Set(['jumps', 'radius', 'damageMultiplier', 'falloff']),
  splitFire: new Set(['maxTargets', 'damageMultiplier', 'range', 'canTargetAir', 'allowMinimumDamage']),
  sideWeapon: new Set(['damage', 'range', 'maxTargets', 'canTargetAir']),
  conditionalAttackMode: new Set(['minTargets', 'radius', 'damageMultiplier']),
  sweepAttack: new Set(['width', 'damageMultiplier', 'maxTargets', 'sizeBonusMultiplier']),
  emergeStrikePending: new Set(['attackMult', 'aoeRadiusAdd']),
  smokeOnAction: new Set(['radius', 'duration', 'rangeSuppression', 'outputSuppression', 'accuracySuppression']),
  pullOnHit: new Set(['radius', 'strength', 'maxTargets']),
  knockbackOnHit: new Set(['radius', 'strength', 'maxTargets']),
  controlBeam: new Set(['progressPerTick', 'conversionThreshold', 'range', 'maxTargets', 'multiTargetProgressMultiplier', 'breakOnRange', 'breakOnDeath', 'breakOnCleanse', 'healConvertedToMax']),
  controlProgress: new Set(['sourceUnitId', 'sourceTeam', 'progress', 'threshold', 'breakOnCleanse']),
  burrowConfig: CANONICAL_BURROW_CONFIG_KEY_SET,
  modeSwitchConfig: new Set(['trigger', 'startMode', 'groundForAction', 'airSpeedMultiplier', 'groundSpeedMultiplier']),
  stanceConfig: new Set(['mode', 'deployTicks', 'rangeMultiplier', 'cooldownMultiplier', 'speedMultiplier']),
  transformState: new Set(['appliedIds']),
  flatDamageBlock: new Set(['amount', 'perRank', 'minimumDamage']),
  shieldHitBlock: new Set(['charges']),
  formationModifiers: new Set(['spacingMultiplier', 'adjacencyBonus']),
  statGrowth: new Set(['intervalTicks', 'maxStacks', 'attackMultPerStack', 'hpMultPerStack', 'nextTick', 'stacks']),
  attackCharge: new Set(['intervalTicks', 'maxStacks', 'attackMultPerStack', 'nextTick', 'stacks']),
  spawnerConfig: new Set(['unitType', 'interval', 'timer']),
  reassemblyConfig: new Set(['delayTicks', 'hpPercent', 'maxTriggers']),
  reassemblyState: new Set(['remainingTicks', 'hpPercent', 'sourceUnitId']),
  rankScaling: new Set(['hpMultPerRank', 'attackMultPerRank', 'defenseAddPerRank', 'rangeAddPerRank', 'cooldownReductionPerRank', 'damageModifiers']),
  delivery: new Set(['kind', 'speed', 'homing', 'windupTicks', 'interceptable', 'flightTicks']),
  markOnHit: CANONICAL_TARGET_MARK_KEY_SET,
}

export const SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS: Record<string, Set<string>> = {
  statusOnHit: CANONICAL_STATUS_EFFECT_KEY_SET,
  conditionalRange: new Set(['target', 'tag', 'rangeAdd', 'rangeMult']),
  transformMode: new Set(['id', 'mode', 'trigger', 'hpThreshold', 'hpMult', 'attackMult', 'speedMult', 'rangeMult', 'cooldownMult', 'aoeRadiusAdd', 'isFlying', 'canTargetAir', 'jumpDistance']),
  fieldEffect: new Set(['id', 'kind', 'radius', 'intervalTicks', 'initialDelayTicks', 'duration', 'value', 'capacity', 'hazardTypes', 'statusEffects', 'hazardType', 'damagePerTick', 'nextTick']),
  triggerEffects: new Set(['id', 'event', 'threshold', 'count', 'repeatable', 'maxTriggers', 'cooldownTicks', 'payload', 'fired', 'counter', 'triggersRemaining', 'cooldownRemaining']),
  periodicAbilities: new Set(['id', 'intervalTicks', 'initialDelayTicks', 'charges', 'targetPolicy', 'payload', 'canTargetAir', 'minRange', 'maxRange', 'nextTick', 'chargesRemaining']),
  periodicProgramState: new Set(['id', 'intervalTicks', 'initialDelayTicks', 'charges', 'targetPolicy', 'payload', 'canTargetAir', 'minRange', 'maxRange', 'nextTick', 'chargesRemaining']),
}

export const ABILITY_PROGRAM_KEY_SET = new Set(['id', 'trigger', 'priority', 'groups'])
export const ABILITY_TRIGGER_KEY_SET = new Set(['kind', 'intervalTicks'])
export const ABILITY_GROUP_KEY_SET = new Set(['selector', 'effects'])
export const ABILITY_SELECTOR_KEY_SET = new Set(['kind', 'radius', 'maxTargets'])
export const ABILITY_DAMAGE_EXPR_KEY_SET = new Set(['kind', 'amount', 'multiplier'])

