import type { BurrowConfig, ConditionalRangeConfig, ControlBeamConfig, ControlProgressState, DelayedReassemblyConfig, MobilityMode, RankScalingConfig, ReassemblyState, StanceMode, TargetPriorityProfile, Team, UnitModeSwitchConfig, UnitStanceConfig } from './combat.primitives'

export interface UnitIdentityComponent {
  id: string
  team: Team
  type: string
  rank?: number
  squadId?: string
  summonOwnerId?: string
  summonSourceId?: string
}

export interface UnitTransformComponent {
  x: number; y: number
  velocity: { x: number; y: number }
  currentAngle: number; initialAngle?: number
  offsetX?: number; offsetY?: number
  size: 'S' | 'M' | 'L' | 'XL'
  isFlying: boolean
}

export interface UnitVitalityComponent {
  hp: number; maxHp: number
  shield: number; maxShield: number
  isDead: boolean
  resurrectOnce?: boolean
  isTemporary?: boolean; temporaryDuration?: number
  reassemblyConfig?: DelayedReassemblyConfig
  reassemblyState?: ReassemblyState
  reassemblyTriggersUsed?: number
}

export interface UnitCombatComponent {
  attack: number; defense: number; speed: number; range: number
  actionCooldownMax: number; actionCooldown: number
  canTargetAir: boolean; multishot?: number
  antiAirDamageMult?: number; executeThreshold?: number; lifestealMult?: number
  groundDamageMult?: number; shieldDamageMult?: number; armorPierceRatio?: number
  summonCounterDamageMult?: number; accuracyPenaltyResist?: number
  rankScaling?: RankScalingConfig
}

export interface UnitTargetingComponent {
  attackTargetId?: string; rampTargetId?: string
  rampMultiplier?: number; chargeDistance?: number; aggroLockTicks: number
  designatedSquadId?: string
  meleeSlotTargetId?: string; meleeSlotIndex?: number; meleeWaitingTargetId?: string
  targetPriorityProfile?: TargetPriorityProfile
  conditionalRange?: ConditionalRangeConfig[]
  controlBeam?: ControlBeamConfig; controlProgress?: ControlProgressState
}

export interface UnitMovementComponent {
  turnSpeed: number
  isMoving?: boolean; isNavigatingObstacle?: boolean
  lastProgressX?: number; lastProgressY?: number; lastTargetDistance?: number
  lastProgressTargetId?: string; stuckTicks?: number
  avoidanceSide?: -1 | 1; avoidanceTicks?: number
  damageReductionWhileMoving?: number
  burrowConfig?: BurrowConfig; isBurrowed?: boolean
  modeSwitchConfig?: UnitModeSwitchConfig; mobilityMode?: MobilityMode
  stanceConfig?: UnitStanceConfig; stanceMode?: StanceMode; stanceTicks?: number
  stealthWhileMoving?: boolean; movementStealthActive?: boolean
}
