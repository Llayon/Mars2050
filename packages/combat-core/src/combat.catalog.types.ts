import type { TargetingProfileConfig, UnitTypeConfig } from './combat.types.js'
import type { AttackChargeConfig, BarrageAttackConfig, BeamAttackConfig, ChainAttackConfig, ConditionalAttackModeConfig, ConditionalRangeConfig, ConeAttackConfig, ControlBeamConfig, DelayedReassemblyConfig, FieldEffectConfig, FlatDamageBlockConfig, FormationModifiersConfig, LinePierceConfig, PeriodicAbilityConfig, RankScalingConfig, ShieldHitBlockConfig, SideWeaponConfig, SplitFireConfig, StatGrowthConfig, SweepAttackConfig, TargetPriorityProfile, TransformModeConfig, TriggerEffectConfig } from './combat.sim.types.js'

export interface UpgradeModifiers {
  hpMult?: number; attackMult?: number; speedMult?: number; rangeAdd?: number
  cooldownMult?: number; addFlying?: boolean; addAoE?: number; defenseAdd?: number
  grantShield?: number; stealthWhileMoving?: boolean; onDeathSpawn?: string
  periodicSpawn?: { unit: string; interval: number }; disableEnemyTech?: boolean
  leaveAoePuddle?: boolean; damageReductionWhileMoving?: number
  burrowWhileMoving?: { damageReduction: number }; onDeathPuddle?: 'napalm' | 'acid' | 'emp'
  multishot?: number; antiAirDamageMult?: number; grantAntiAir?: boolean
  grantShieldFlat?: number; replicateOnKill?: boolean; resurrectOnce?: boolean
  stealthUntilAttack?: boolean; executeThreshold?: number; lifestealMult?: number
  groundDamageMult?: number; shieldDamageMult?: number; armorPierceRatio?: number
  summonCounterDamageMult?: number; accuracyPenaltyResist?: number
  grantRevealAura?: { radius: number; duration: number; interval?: number }
  periodicAbilities?: PeriodicAbilityConfig[]; triggerEffects?: TriggerEffectConfig[]
  transformMode?: TransformModeConfig[]; controlBeam?: ControlBeamConfig
  fieldEffect?: FieldEffectConfig[]; formationModifiers?: FormationModifiersConfig
  statGrowth?: StatGrowthConfig; attackCharge?: AttackChargeConfig
  reassembly?: DelayedReassemblyConfig; rankScaling?: RankScalingConfig
  conditionalRange?: ConditionalRangeConfig[]; flatDamageBlock?: FlatDamageBlockConfig
  shieldHitBlock?: ShieldHitBlockConfig; targetPriorityProfile?: TargetPriorityProfile
  conditionalAttackMode?: ConditionalAttackModeConfig; sweepAttack?: SweepAttackConfig
  linePierce?: LinePierceConfig; coneAttack?: ConeAttackConfig
  beamAttack?: BeamAttackConfig; barrageAttack?: BarrageAttackConfig
  chainAttack?: ChainAttackConfig; splitFire?: SplitFireConfig; sideWeapon?: SideWeaponConfig
}

export interface UpgradeConfig {
  id: string
  name: string
  description?: string
  cost?: number
  allowedUnits?: string[]
  hiddenFromSimulator?: boolean
  modifiers: UpgradeModifiers
}

export interface CombatCatalog {
  readonly unitTypes: Readonly<Record<string, UnitTypeConfig>>
  readonly upgrades?: Readonly<Record<string, UpgradeConfig>>
  readonly targetingProfiles?: Readonly<Record<string, TargetingProfileConfig>>
}

let defaultCombatCatalog: CombatCatalog | undefined = undefined

export function registerDefaultCombatCatalog(catalog: CombatCatalog | undefined): void {
  defaultCombatCatalog = catalog
}

export function getDefaultCombatCatalog(): CombatCatalog | undefined {
  return defaultCombatCatalog
}
