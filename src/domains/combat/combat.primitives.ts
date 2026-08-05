import type { AttackChargeConfig, ConditionalAttackModeConfig, DelayedReassemblyConfig, RuntimeAttackCharge, RuntimeStatGrowth, StatGrowthConfig, SweepAttackConfig, TargetPriorityProfile } from './combat.advanced-primitives'
export type { AttackChargeConfig, ConditionalAttackModeConfig, DelayedReassemblyConfig, ReassemblyState, RuntimeAttackCharge, RuntimeStatGrowth, StatGrowthConfig, SweepAttackConfig, TargetPriorityProfile } from './combat.advanced-primitives'

export type Team = 'attacker' | 'defender'
export type CombatTag =
  | 'infantry' | 'vehicle' | 'aircraft' | 'structure'
  | 'organic' | 'mechanical' | 'armored' | 'light' | 'heavy'
  | 'shielded' | 'healer' | 'support' | 'summoner' | 'summoned' | 'stealth' | 'explosive'

export type StatusType =
  | 'emp' | 'slow' | 'burn' | 'acid' | 'vulnerable' | 'range_suppressed' | 'revealed'
  | 'hacked' | 'damage_reduction' | 'regen' | 'output_suppressed' | 'accuracy_reduced' | 'armor_broken' | 'degeneration' | 'haste' | 'range_boost' | 'attack_boost' | 'status_immunity'
export type HackControlMode = 'disable' | 'redirect' | 'confuse'
export type StanceMode = 'mobile' | 'deployed'
export type MobilityMode = 'ground' | 'air'
export type HazardKind = 'napalm' | 'radiation' | 'emp_field' | 'acid' | 'emp' | 'mine' | 'smoke' | 'barrier_dome'

export interface UnitStanceConfig { mode: 'siege' | 'entrenched'; deployTicks: number; rangeMultiplier?: number; cooldownMultiplier?: number; speedMultiplier?: number }
export interface BurrowConfig { damageReduction: number; regenPercentPerTick?: number; emergeAttackMult?: number; emergeAoeRadiusAdd?: number }
export interface UnitModeSwitchConfig { trigger: 'while_moving'; startMode?: MobilityMode; groundForAction?: boolean; airSpeedMultiplier?: number; groundSpeedMultiplier?: number }
export interface StatusEffect { type: StatusType; duration: number; value?: number; sourceUnitId?: string; stackKey?: string; controlMode?: HackControlMode; tickInterval?: number }
export interface RuntimeStatusEffect extends StatusEffect { tickInterval: number; nextTickIn: number }
export type MarkRetargetPolicy = 'always' | 'new_squad_only' | 'none'
export interface RampDamageConfig { step: number; maxMultiplier: number }
export interface ChargeDamageConfig {
  minDistance: number
  maxDistance: number
  maxMultiplier: number
}
export interface MineOnActionConfig {
  radius: number
  damage: number
  duration: number
}
export interface OnKillConfig {
  cooldownReset?: boolean
  healPercent?: number
  status?: StatusEffect
}
export interface TargetMark {
  sourceUnitId: string; duration: number; damageMultiplier?: number
  sharedDamage?: boolean; squadWide?: boolean; executeThreshold?: number
  focusPriority?: number; focusRadius?: number
  retargetPolicy?: MarkRetargetPolicy; retargetLockTicks?: number
}
export type TargetMarkConfig = Omit<TargetMark, 'sourceUnitId'>
export type PercentHpDamageBasis = 'max' | 'current'
export interface PercentHpDamageConfig { percent: number; basis?: PercentHpDamageBasis; maxBonus?: number; minBonus?: number }
export type ConditionalRangeTarget = 'air' | 'ground' | 'tag' | 'same_rank' | 'higher_rank' | 'lower_rank'
export type RankRelation = 'same_rank' | 'higher_rank' | 'lower_rank'
export interface ConditionalRangeConfig { target: ConditionalRangeTarget; tag?: CombatTag; rangeAdd?: number; rangeMult?: number }
export interface RankDamageModifierConfig { relation: RankRelation; multiplier: number }
export interface RankScalingConfig { hpMultPerRank?: number; attackMultPerRank?: number; defenseAddPerRank?: number; rangeAddPerRank?: number; cooldownReductionPerRank?: number; damageModifiers?: RankDamageModifierConfig[] }
export interface FlatDamageBlockConfig { amount: number; perRank?: number; minimumDamage?: number }
export interface ShieldHitBlockConfig { charges: number }
export interface LinePierceConfig { width: number; damageMultiplier: number; maxTargets?: number }
export interface ConeAttackConfig { angleDeg: number; damageMultiplier: number; maxTargets?: number }
export interface BeamAttackConfig { width: number; damageMultiplier: number; maxTargets?: number }
export interface BarrageAttackConfig { impacts: number; radius: number; spreadRadius: number; damageMultiplier: number; maxTargetsPerImpact?: number; impactIntervalTicks?: number }
export interface ChainAttackConfig { jumps: number; radius: number; damageMultiplier: number; falloff?: number }
export interface SplitFireConfig { maxTargets: number; damageMultiplier: number; range?: number; canTargetAir?: boolean; allowMinimumDamage?: boolean }
export interface SideWeaponConfig { damage: number; range: number; maxTargets: number; canTargetAir?: boolean }

export type SupportAuraType = 'shield' | 'shield_repair' | 'regen' | 'reveal' | 'damage_reduction' | 'haste' | 'range_boost' | 'attack_boost' | 'cleanse' | 'status_immunity'
export type SupportAuraTarget = 'allies' | 'enemies'
export interface SupportAura {
  type: SupportAuraType; radius: number; value: number; duration?: number; interval?: number
  target: SupportAuraTarget; targetTags?: CombatTag[]
}

export type PeriodicTargetPolicy = 'current_target' | 'nearest_enemy' | 'nearest_air' | 'nearest_ground' | 'ally_lowest_hp' | 'self'
export type PeriodicAbilityPayload =
  | { kind: 'damage'; amount?: number; percentHp?: PercentHpDamageConfig; radius?: number; statusEffects?: StatusEffect[] }
  | { kind: 'status'; effects: StatusEffect[] }
  | { kind: 'hazard'; hazardType: HazardKind; radius: number; duration: number; damagePerTick?: number; statusEffects?: StatusEffect[] }
  | { kind: 'shield'; amount: number }
  | { kind: 'heal'; amount?: number; percentMaxHp?: number; radius?: number; cleanse?: StatusType[] }
  | { kind: 'spawn'; unitType: string; count?: number; cap?: number; hpPercent?: number; spreadRadius?: number }
  | { kind: 'mark'; mark: TargetMarkConfig; radius?: number }
export interface PeriodicAbilityConfig {
  id: string; intervalTicks: number; initialDelayTicks?: number; charges?: number
  targetPolicy?: PeriodicTargetPolicy; payload: PeriodicAbilityPayload; canTargetAir?: boolean; minRange?: number; maxRange?: number
}
export interface RuntimePeriodicAbility extends PeriodicAbilityConfig { nextTick: number; chargesRemaining?: number }

export type TriggerEvent = 'hp_threshold' | 'attack_count' | 'damage_taken' | 'death' | 'kill'
export type TriggerTarget = 'self' | 'target' | 'attacker' | 'killer' | 'victim' | 'nearest_enemy'
export type TriggerPayload =
  | { kind: 'status'; target: TriggerTarget; status: StatusEffect }
  | { kind: 'shield'; target: TriggerTarget; amount: number }
  | { kind: 'heal'; target: TriggerTarget; amount?: number; percentMaxHp?: number; victimMaxHpPercent?: number }
  | { kind: 'damage'; target: TriggerTarget; amount?: number; percentHp?: PercentHpDamageConfig; radius?: number }
  | { kind: 'spawn'; target: TriggerTarget; unitType: string; count?: number; cap?: number; hpPercent?: number }
  | { kind: 'field'; target: TriggerTarget; field: FieldEffectConfig }
  | { kind: 'delayed_reassembly'; target: TriggerTarget; delayTicks: number; hpPercent?: number }
  | { kind: 'cooldown_reset'; target: TriggerTarget }
export interface TriggerEffectConfig {
  id: string; event: TriggerEvent; threshold?: number; count?: number; repeatable?: boolean; maxTriggers?: number
  cooldownTicks?: number; payload: TriggerPayload
}
export interface RuntimeTriggerEffect extends TriggerEffectConfig {
  fired: boolean; counter: number; triggersRemaining?: number; cooldownRemaining: number
}

export interface ControlBeamConfig {
  progressPerTick: number; conversionThreshold: number; range?: number; maxTargets?: number
  multiTargetProgressMultiplier?: number; breakOnRange?: boolean; breakOnDeath?: boolean
  breakOnCleanse?: boolean; healConvertedToMax?: boolean
}
export interface ControlProgressState {
  sourceUnitId: string; sourceTeam: Team; progress: number; threshold: number; breakOnCleanse: boolean
}

export type TransformModeKind = 'assault' | 'aerial' | 'land' | 'entrenched' | 'jump'
export interface TransformModeConfig {
  id: string; mode: TransformModeKind; trigger: 'battle_start' | 'hp_threshold'; hpThreshold?: number
  hpMult?: number; attackMult?: number; speedMult?: number; rangeMult?: number; cooldownMult?: number
  aoeRadiusAdd?: number; isFlying?: boolean; canTargetAir?: boolean; jumpDistance?: number
}
export interface TransformModeState { appliedIds: string[] }

export type FieldEffectKind = 'barrier_dome' | 'cleanse_field' | 'hazard_field'
export interface FieldEffectConfig {
  id: string; kind: FieldEffectKind; radius: number; intervalTicks: number; initialDelayTicks?: number; duration?: number
  value?: number; capacity?: number; hazardTypes?: HazardKind[]; statusEffects?: StatusEffect[]; hazardType?: HazardKind; damagePerTick?: number
}
export interface RuntimeFieldEffect extends FieldEffectConfig { nextTick: number }

export interface FormationModifiersConfig {
  spacingMultiplier?: number
  adjacencyBonus?: { radius: number; maxStacks: number; damageReductionPerAlly?: number; rangeBoostPerAlly?: number; attackBoostPerAlly?: number }
}

export interface AdvancedPrimitiveConfig {
  statGrowth?: StatGrowthConfig; attackCharge?: AttackChargeConfig; reassembly?: DelayedReassemblyConfig
  targetPriorityProfile?: TargetPriorityProfile; conditionalAttackMode?: ConditionalAttackModeConfig; sweepAttack?: SweepAttackConfig
}

export interface RuntimeAdvancedPrimitiveState {
  statGrowth?: RuntimeStatGrowth; attackCharge?: RuntimeAttackCharge
}
