import type { BarrageAttackConfig, BeamAttackConfig, ChainAttackConfig, CombatTag, ConeAttackConfig, LinePierceConfig, PeriodicAbilityConfig, SideWeaponConfig, SplitFireConfig, StatusType, SupportAura, Team } from './combat.primitives'

export type AbilityTrigger =
  | { kind: 'weapon_attack' }
  | { kind: 'post_weapon_attack' }
  | { kind: 'projectile_launch' }
  | { kind: 'projectile_impact' }
  | { kind: 'hit' }
  | { kind: 'kill' }
  | { kind: 'death' }
  | { kind: 'periodic'; intervalTicks: number }

export type AbilityTriggerKind = AbilityTrigger['kind']

export interface AbilityExecutionOptions {
  hitKind?: 'primary' | 'secondary'
}

export interface TargetFilter {
  includeTags?: CombatTag[]
  excludeTags?: CombatTag[]
  teams?: Team | 'enemy' | 'ally' | 'both'
  airMode?: 'ground' | 'air' | 'both'
}

export type TargetSelector =
  | { kind: 'primary_target'; filter?: TargetFilter }
  | { kind: 'self'; filter?: TargetFilter }
  | { kind: 'impact_point'; filter?: TargetFilter }
  | { kind: 'area_at_target'; radius: number; maxTargets?: number; filter?: TargetFilter }
  | { kind: 'area_at_impact'; radius: number; maxTargets?: number; filter?: TargetFilter }
  | { kind: 'chain'; radius: number; jumps: number; filter?: TargetFilter }
  | { kind: 'line'; width: number; length: number; filter?: TargetFilter }
  | { kind: 'cone'; angleDeg: number; range: number; filter?: TargetFilter }

export type AbilityEffect =
  | { kind: 'damage'; amount: number; damageClass?: 'kinetic' | 'energy' | 'true' }
  | { kind: 'heal'; amount: number }
  | { kind: 'apply_status'; status: StatusType; duration: number; value?: number; controlMode?: 'disable' | 'redirect' | 'confuse' }
  | { kind: 'displace'; mode: 'pull' | 'knockback'; strength: number }
  | { kind: 'launch_projectile'; speed: number; windupTicks?: number; onImpact: AbilityEffectGroup[] }
  | { kind: 'create_hazard'; hazard: string; duration: number; radius: number }
  | { kind: 'spawn_unit'; unitType: string; count: number }
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
