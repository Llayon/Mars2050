import type { BarrageAttackConfig, BeamAttackConfig, ChainAttackConfig, ConditionalAttackModeConfig, ConeAttackConfig, FlatDamageBlockConfig, FormationModifiersConfig, LinePierceConfig, RuntimeAttackCharge, RuntimeFieldEffect, RuntimePeriodicAbility, RuntimeStatGrowth, RuntimeStatusEffect, RuntimeTriggerEffect, ShieldHitBlockConfig, SideWeaponConfig, SplitFireConfig, StatusEffect, SupportAura, SweepAttackConfig, TargetMark, TargetMarkConfig, TransformModeConfig, TransformModeState } from './combat.primitives'

export interface UnitWeaponComponent {
  attackType: 'single' | 'aoe' | 'heal' | 'spawn'
  aoeRadius?: number; spawnType?: string; spawnCap?: number
  selfDestructOnAttack?: boolean
  statusOnHit?: StatusEffect[]; markOnHit?: TargetMarkConfig
  linePierce?: LinePierceConfig; coneAttack?: ConeAttackConfig; beamAttack?: BeamAttackConfig
  barrageAttack?: BarrageAttackConfig; chainAttack?: ChainAttackConfig
  splitFire?: SplitFireConfig; sideWeapon?: SideWeaponConfig
  conditionalAttackMode?: ConditionalAttackModeConfig; sweepAttack?: SweepAttackConfig
  emergeStrikePending?: { attackMult?: number; aoeRadiusAdd?: number }
  appliesEmp?: boolean; leavesPuddle?: boolean
  smokeOnAction?: { radius: number; duration: number; rangeSuppression?: number; outputSuppression?: number; accuracySuppression?: number }
  pullOnHit?: { radius: number; strength: number; maxTargets?: number }
  knockbackOnHit?: { radius: number; strength: number; maxTargets?: number }
}

export interface UnitStatusControlComponent {
  statusEffects: RuntimeStatusEffect[]
  targetMark?: TargetMark
  stealthUntilAttack?: boolean; hasAttacked?: boolean
  transformMode?: TransformModeConfig[]; transformState?: TransformModeState
}

export interface UnitDefenseComponent {
  flatDamageBlock?: FlatDamageBlockConfig
  shieldHitBlock?: ShieldHitBlockConfig; shieldHitBlockCharges?: number
  reactiveArmorCharges?: number; reactiveArmorBlock?: number
  damageShareRadius?: number; damageShareRatio?: number; damageShareMaxTargets?: number
  projectileInterceptRadius?: number; projectileInterceptCooldownMax?: number
  projectileInterceptCooldown?: number; projectileInterceptMaxDamage?: number
}

export interface UnitSupportComponent {
  supportAuras?: SupportAura[]
  periodicAbilities?: RuntimePeriodicAbility[]
  fieldEffect?: RuntimeFieldEffect[]
  formationModifiers?: FormationModifiersConfig
}

export interface UnitLifecycleComponent {
  triggerEffects?: RuntimeTriggerEffect[]
  statGrowth?: RuntimeStatGrowth; attackCharge?: RuntimeAttackCharge
  spawnerConfig?: { unitType: string; interval: number; timer: number }
  replicateOnKill?: boolean
  onDeathPuddle?: 'napalm' | 'acid' | 'emp'
}
