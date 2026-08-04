import type { HazardKind, StatusEffect, Team } from './combat.primitives'
import type { UnitSnapshot } from './combat.unit-components'
export type { AttackChargeConfig, BarrageAttackConfig, BeamAttackConfig, BurrowConfig, ChainAttackConfig, ChargeDamageConfig, CombatTag, ConditionalAttackModeConfig, ConditionalRangeConfig, ConditionalRangeTarget, ControlBeamConfig, ControlProgressState, ConeAttackConfig, DelayedReassemblyConfig, FieldEffectConfig, FieldEffectKind, FlatDamageBlockConfig, FormationModifiersConfig, HackControlMode, HazardKind, LinePierceConfig, MineOnActionConfig, MobilityMode, OnKillConfig, PercentHpDamageBasis, PercentHpDamageConfig, PeriodicAbilityConfig, PeriodicAbilityPayload, PeriodicTargetPolicy, RampDamageConfig, RankDamageModifierConfig, RankRelation, RankScalingConfig, ReassemblyState, RuntimeAttackCharge, RuntimeFieldEffect, RuntimePeriodicAbility, RuntimeStatGrowth, RuntimeStatusEffect, RuntimeTriggerEffect, ShieldHitBlockConfig, SideWeaponConfig, SplitFireConfig, StatGrowthConfig, StatusEffect, StatusType, StanceMode, SupportAura, SupportAuraTarget, SupportAuraType, SweepAttackConfig, TargetMark, TargetMarkConfig, TargetPriorityProfile, Team, TransformModeConfig, TransformModeKind, TransformModeState, TriggerEffectConfig, TriggerEvent, TriggerPayload, TriggerTarget, UnitModeSwitchConfig, UnitStanceConfig } from './combat.primitives'

export interface Obstacle { x: number; y: number; radius: number }

export interface SimHazard { id: string; team: Team; type: HazardKind; x: number; y: number; radius: number; damagePerTick: number; duration: number; statusEffects?: StatusEffect[]; damageReduction?: number; capacity?: number; maxCapacity?: number; sourceUnitId?: string }

export type SimUnit = UnitSnapshot
