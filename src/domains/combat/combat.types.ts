import { Database, UnitsType } from '@/types/database'
import type { AttackChargeConfig, BarrageAttackConfig, BeamAttackConfig, BurrowConfig, ChainAttackConfig, CombatTag, ConditionalAttackModeConfig, ConditionalRangeConfig, ConeAttackConfig, ControlBeamConfig, DelayedReassemblyConfig, FieldEffectConfig, FlatDamageBlockConfig, FormationModifiersConfig, LinePierceConfig, PercentHpDamageConfig, PeriodicAbilityConfig, RankScalingConfig, ShieldHitBlockConfig, SideWeaponConfig, SplitFireConfig, StatGrowthConfig, StatusEffect, SupportAura, SweepAttackConfig, TargetMarkConfig, TargetPriorityProfile, TransformModeConfig, TriggerEffectConfig, UnitModeSwitchConfig, UnitStanceConfig } from './combat.sim.types'

export type UnitRow = Database['public']['Tables']['units']['Row']
export type BattleRow = Database['public']['Tables']['battles']['Row']
export type UnitTypeKey = UnitsType
export type TargetingAcquisition = 'local' | 'global'
export type TargetingProfileKey =
  | 'default_local' | 'long_range_priority' | 'anti_air'
  | 'anti_armor' | 'siege' | 'assassin' | 'support_hunter'
  | 'flanker_local' | 'demolition_local'
export type TargetingProfile = TargetingProfileKey

export interface TargetingProfileConfig {
  acquisition: TargetingAcquisition
  distanceWeight: number
  currentTargetBonus: number
  lowHpWeight: number
  targetingCooldownTicks?: number
  preferredTags?: Partial<Record<CombatTag, number>>
  avoidedTags?: Partial<Record<CombatTag, number>>
}

export interface UnitBaseStats {
  hp: number; attack: number; defense: number; speed: number; range: number
  minimumRange?: number
  attackType: 'single' | 'aoe' | 'heal' | 'spawn'
  aoeRadius?: number; spawnType?: string; spawnCap?: number; actionCooldownMax?: number
  spawnOverrides?: { hp?: number; attack?: number; isTemporary?: boolean; duration?: number }
  coneAttack?: ConeAttackConfig
  beamAttack?: BeamAttackConfig
  barrageAttack?: BarrageAttackConfig
  chainAttack?: ChainAttackConfig
  splitFire?: SplitFireConfig
  sideWeapon?: SideWeaponConfig
  rampDamage?: { step: number; maxMultiplier: number }
  chargeDamage?: { minDistance: number; maxDistance: number; maxMultiplier: number }
  percentHpDamage?: PercentHpDamageConfig & { maxBonus: number }
  shieldDamageMult?: number; armorPierceRatio?: number; antiAirDamageMult?: number; summonCounterDamageMult?: number; accuracyPenaltyResist?: number
  onKill?: { cooldownReset?: boolean; healPercent?: number; status?: StatusEffect }
  linePierce?: LinePierceConfig
  pullOnHit?: { radius: number; strength: number; maxTargets?: number }
  knockbackOnHit?: { radius: number; strength: number; maxTargets?: number }
  stance?: UnitStanceConfig
  modeSwitch?: UnitModeSwitchConfig
  burrowWhileMoving?: BurrowConfig
  reactiveArmor?: { charges: number; block: number }; damageShare?: { radius: number; ratio: number; maxTargets?: number }
  projectileInterception?: { radius: number; cooldownTicks: number; maxDamage?: number }
  healTargetTags?: CombatTag[]
  statusOnHit?: StatusEffect[]
  markOnHit?: TargetMarkConfig
  supportAuras?: SupportAura[]
  mineOnAction?: { radius: number; damage: number; duration: number }
  smokeOnAction?: { radius: number; duration: number; rangeSuppression?: number; outputSuppression?: number; accuracySuppression?: number }
  periodicAbilities?: PeriodicAbilityConfig[]; triggerEffects?: TriggerEffectConfig[]; transformMode?: TransformModeConfig[]; controlBeam?: ControlBeamConfig; fieldEffect?: FieldEffectConfig[]; formationModifiers?: FormationModifiersConfig
  statGrowth?: StatGrowthConfig; attackCharge?: AttackChargeConfig; reassembly?: DelayedReassemblyConfig
  rankScaling?: RankScalingConfig; conditionalRange?: ConditionalRangeConfig[]; flatDamageBlock?: FlatDamageBlockConfig; shieldHitBlock?: ShieldHitBlockConfig
  targetPriorityProfile?: TargetPriorityProfile; conditionalAttackMode?: ConditionalAttackModeConfig; sweepAttack?: SweepAttackConfig
  isFlying?: boolean; canTargetAir?: boolean
  stealthWhileMoving?: boolean
  targetingProfile?: TargetingProfile
  combatTags?: CombatTag[]
  turnSpeed?: number // Radians per tick
  size?: 'S' | 'M' | 'L' | 'XL'
}

export interface UnitTypeConfig {
  name: string
  baseStats: UnitBaseStats
  hireCost: Record<string, number>
  squadSize?: number
  squadSpacing?: number
  formation?: 'line' | 'wedge' | 'grid'
}

export type { Team, CombatTag, StatusEffect, StatusType, HackControlMode, StanceMode, MobilityMode, UnitStanceConfig, UnitModeSwitchConfig, BurrowConfig, SupportAura, SupportAuraType, TargetMark, TargetMarkConfig, PercentHpDamageBasis, PercentHpDamageConfig, PeriodicAbilityConfig, RuntimePeriodicAbility, TriggerEffectConfig, RuntimeTriggerEffect, ControlBeamConfig, FieldEffectConfig, RuntimeFieldEffect, TransformModeConfig, FormationModifiersConfig, AttackChargeConfig, ConditionalAttackModeConfig, DelayedReassemblyConfig, StatGrowthConfig, SweepAttackConfig, TargetPriorityProfile, RankScalingConfig, ConditionalRangeConfig, FlatDamageBlockConfig, ShieldHitBlockConfig, LinePierceConfig, ConeAttackConfig, BeamAttackConfig, BarrageAttackConfig, ChainAttackConfig, SplitFireConfig, SideWeaponConfig, Obstacle, SimHazard, SimUnit } from './combat.sim.types'
export * from './combat.actions'

