import type { BurrowConfig, ConditionalAttackModeConfig, ControlBeamConfig, ControlProgressState, DelayedReassemblyConfig, FieldEffectConfig, FormationModifiersConfig, HazardKind, MobilityMode, ReassemblyState, RuntimeAttackCharge, RuntimeFieldEffect, RuntimePeriodicAbility, RuntimeStatGrowth, RuntimeTriggerEffect, StanceMode, StatusEffect, SupportAura, SweepAttackConfig, TargetMark, TargetMarkConfig, TargetPriorityProfile, Team, TransformModeConfig, TransformModeState, UnitModeSwitchConfig, UnitStanceConfig } from './combat.primitives'
export type { AttackChargeConfig, BurrowConfig, CombatTag, ConditionalAttackModeConfig, ControlBeamConfig, ControlProgressState, DelayedReassemblyConfig, FieldEffectConfig, FieldEffectKind, FormationModifiersConfig, HackControlMode, HazardKind, MobilityMode, PercentHpDamageBasis, PercentHpDamageConfig, PeriodicAbilityConfig, PeriodicAbilityPayload, PeriodicTargetPolicy, ReassemblyState, RuntimeAttackCharge, RuntimeFieldEffect, RuntimePeriodicAbility, RuntimeStatGrowth, RuntimeTriggerEffect, StatGrowthConfig, StatusEffect, StatusType, StanceMode, SupportAura, SupportAuraTarget, SupportAuraType, SweepAttackConfig, TargetMark, TargetMarkConfig, TargetPriorityProfile, Team, TransformModeConfig, TransformModeKind, TransformModeState, TriggerEffectConfig, TriggerEvent, TriggerPayload, TriggerTarget, UnitModeSwitchConfig, UnitStanceConfig } from './combat.primitives'

export interface Obstacle { x: number; y: number; radius: number }

export interface SimHazard { id: string; team: Team; type: HazardKind; x: number; y: number; radius: number; damagePerTick: number; duration: number; statusEffects?: StatusEffect[]; damageReduction?: number; capacity?: number; maxCapacity?: number; sourceUnitId?: string }

export interface SimUnit {
  id: string
  team: Team
  type: string
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  range: number
  attackType: 'single' | 'aoe' | 'heal' | 'spawn'
  aoeRadius?: number; spawnType?: string; spawnCap?: number
  actionCooldownMax: number
  actionCooldown: number
  isFlying: boolean
  canTargetAir: boolean
  isTemporary?: boolean; temporaryDuration?: number
  x: number
  y: number
  isDead: boolean
  squadId?: string
  summonOwnerId?: string
  summonSourceId?: string
  attackTargetId?: string
  rampTargetId?: string; rampMultiplier?: number; chargeDistance?: number
  aggroLockTicks: number
  meleeSlotTargetId?: string
  meleeSlotIndex?: number
  meleeWaitingTargetId?: string
  velocity: { x: number; y: number }
  turnSpeed: number
  currentAngle: number
  offsetX?: number
  offsetY?: number
  size: 'S' | 'M' | 'L' | 'XL'
  shield: number
  maxShield: number
  statusEffects: StatusEffect[]
  statusOnHit?: StatusEffect[]; markOnHit?: TargetMarkConfig; targetMark?: TargetMark
  supportAuras?: SupportAura[]
  periodicAbilities?: RuntimePeriodicAbility[]; triggerEffects?: RuntimeTriggerEffect[]; controlBeam?: ControlBeamConfig; controlProgress?: ControlProgressState; transformMode?: TransformModeConfig[]; transformState?: TransformModeState; fieldEffect?: RuntimeFieldEffect[]; formationModifiers?: FormationModifiersConfig
  statGrowth?: RuntimeStatGrowth; attackCharge?: RuntimeAttackCharge; reassemblyConfig?: DelayedReassemblyConfig; reassemblyState?: ReassemblyState; reassemblyTriggersUsed?: number
  targetPriorityProfile?: TargetPriorityProfile; conditionalAttackMode?: ConditionalAttackModeConfig; sweepAttack?: SweepAttackConfig; emergeStrikePending?: { attackMult?: number; aoeRadiusAdd?: number }
  appliesEmp?: boolean
  leavesPuddle?: boolean
  spawnerConfig?: { unitType: string, interval: number, timer: number }
  initialAngle?: number
  isMoving?: boolean
  isNavigatingObstacle?: boolean
  lastProgressX?: number
  lastProgressY?: number
  lastTargetDistance?: number
  lastProgressTargetId?: string
  stuckTicks?: number
  avoidanceSide?: -1 | 1
  avoidanceTicks?: number
  replicateOnKill?: boolean
  stealthUntilAttack?: boolean
  hasAttacked?: boolean
  resurrectOnce?: boolean
  executeThreshold?: number
  lifestealMult?: number
  groundDamageMult?: number; shieldDamageMult?: number; armorPierceRatio?: number; summonCounterDamageMult?: number; accuracyPenaltyResist?: number
  damageReductionWhileMoving?: number
  burrowConfig?: BurrowConfig; isBurrowed?: boolean
  modeSwitchConfig?: UnitModeSwitchConfig; mobilityMode?: MobilityMode
  onDeathPuddle?: 'napalm' | 'acid' | 'emp'
  multishot?: number; antiAirDamageMult?: number
  smokeOnAction?: { radius: number; duration: number; rangeSuppression?: number; outputSuppression?: number; accuracySuppression?: number }
  stanceConfig?: UnitStanceConfig; stanceMode?: StanceMode; stanceTicks?: number
  pullOnHit?: { radius: number; strength: number; maxTargets?: number }; knockbackOnHit?: { radius: number; strength: number; maxTargets?: number }; reactiveArmorCharges?: number; reactiveArmorBlock?: number; damageShareRadius?: number; damageShareRatio?: number; damageShareMaxTargets?: number
  projectileInterceptRadius?: number; projectileInterceptCooldownMax?: number; projectileInterceptCooldown?: number; projectileInterceptMaxDamage?: number
}
