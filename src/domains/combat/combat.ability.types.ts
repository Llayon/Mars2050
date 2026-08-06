import type { BarrageAttackConfig, BeamAttackConfig, ChainAttackConfig, ConeAttackConfig, LinePierceConfig, PeriodicAbilityConfig, SideWeaponConfig, SplitFireConfig, StatusType, SupportAura } from './combat.primitives'
import type { AuthoredEffectPosition } from './ecs/defense-batch'

export type AbilityTrigger =
  | { kind: 'weapon_attack' }
  | { kind: 'post_weapon_attack' }
  | { kind: 'projectile_impact' }
  | { kind: 'hit' }
  | { kind: 'periodic'; intervalTicks: number }

export type AbilityTriggerKind = AbilityTrigger['kind']

export type DamageExpression =
  | { kind: 'fixed'; amount: number }
  | { kind: 'attack_multiplier'; multiplier: number }

export interface AbilityExecutionOptions {
  hitKind?: 'primary' | 'secondary'
  authoredPosition?: AuthoredEffectPosition
}

export type TargetSelector =
  | { kind: 'primary_target' }
  | { kind: 'self' }
  | { kind: 'area_at_target'; radius: number; maxTargets?: number }
  | { kind: 'area_at_impact'; radius: number; maxTargets?: number }

export type AbilityEffect =
  | { kind: 'damage'; expression: DamageExpression }
  | { kind: 'apply_status'; status: StatusType; duration: number; value?: number; controlMode?: 'disable' | 'redirect' | 'confuse' }
  | { kind: 'displace'; mode: 'pull' | 'knockback'; radius: number; strength: number; maxTargets?: number }
  | { kind: 'support_aura'; aura: SupportAura }
  | { kind: 'periodic_payload'; ability: PeriodicAbilityConfig }
  | { kind: 'split_fire'; config: SplitFireConfig }
  | { kind: 'chain_attack'; config: ChainAttackConfig }
  | { kind: 'side_weapon'; config: SideWeaponConfig }
  | { kind: 'barrage_attack'; config: BarrageAttackConfig }
  | { kind: 'line_pierce'; config: LinePierceConfig }
  | { kind: 'cone_attack'; config: ConeAttackConfig }
  | { kind: 'beam_attack'; config: BeamAttackConfig }
  | { kind: 'mark_target'; duration: number; damageMultiplier?: number; executeThreshold?: number; sharedDamage?: boolean; squadWide?: boolean; focusPriority?: number; focusRadius?: number; retargetPolicy?: 'always' | 'new_squad_only' | 'none'; retargetLockTicks?: number }
  | { kind: 'legacy_geometry'; geometry: 'directional' | 'barrage' | 'chain' | 'split' | 'side' | 'conditional' | 'sweep' | 'radial' | 'displacement' }

export interface AbilityEffectGroup {
  selector: TargetSelector
  effects: AbilityEffect[]
}

export interface AbilityDefinition {
  id: string
  trigger: AbilityTrigger
  effects: AbilityEffectGroup[]
  priority?: number
}
