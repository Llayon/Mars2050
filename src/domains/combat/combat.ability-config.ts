import type { AbilityDefinition } from './combat.ability.types'
import type { BarrageAttackConfig, BeamAttackConfig, ChainAttackConfig, ConeAttackConfig, LinePierceConfig, PeriodicAbilityConfig, SideWeaponConfig, SplitFireConfig, StatusType, SupportAura } from './combat.primitives'

export function statusAbility(id: string, status: { type: StatusType; duration: number; value?: number; controlMode?: 'disable' | 'redirect' | 'confuse' }): AbilityDefinition {
  return {
    id,
    trigger: { kind: 'hit' },
    effects: [{
      selector: { kind: 'primary_target' },
      effects: [{ kind: 'apply_status', status: status.type, duration: status.duration, value: status.value, controlMode: status.controlMode }],
    }],
  }
}

export function markAbility(id: string, mark: { duration: number; damageMultiplier?: number; executeThreshold?: number }): AbilityDefinition {
  return {
    id,
    trigger: { kind: 'hit' },
    effects: [{
      selector: { kind: 'primary_target' },
      effects: [{ kind: 'mark_target', duration: mark.duration, damageMultiplier: mark.damageMultiplier, executeThreshold: mark.executeThreshold }],
    }],
  }
}

export function auraAbility(id: string, aura: SupportAura): AbilityDefinition {
  return {
    id,
    trigger: { kind: 'periodic', intervalTicks: aura.interval ?? 10 },
    effects: [{ selector: { kind: 'self' }, effects: [{ kind: 'support_aura', aura: { ...aura } }] }],
  }
}

export function extractSupportAuras(definitions: AbilityDefinition[] | undefined): SupportAura[] {
  return (definitions ?? []).flatMap(definition => definition.effects.flatMap(group =>
    group.effects.flatMap(effect => effect.kind === 'support_aura' ? [effect.aura] : []),
  ))
}

export function periodicAbility(id: string, ability: PeriodicAbilityConfig): AbilityDefinition {
  return {
    id,
    trigger: { kind: 'periodic', intervalTicks: ability.intervalTicks },
    effects: [{ selector: { kind: 'self' }, effects: [{ kind: 'periodic_payload', ability: structuredClone(ability) }] }],
  }
}

export function displaceAbility(id: string, mode: 'pull' | 'knockback', radius: number, strength: number, maxTargets?: number): AbilityDefinition {
  return {
    id,
    trigger: { kind: 'post_weapon_attack' },
    effects: [{
      selector: { kind: 'area_at_target', radius: radius * 40, maxTargets },
      effects: [{ kind: 'displace', mode, strength: strength * 40 }],
    }],
  }
}

export function splitFireAbility(id: string, config: SplitFireConfig): AbilityDefinition {
  return { id, trigger: { kind: 'weapon_attack' }, effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'split_fire', config: { ...config } }] }] }
}

export function chainAttackAbility(id: string, config: ChainAttackConfig): AbilityDefinition {
  return { id, trigger: { kind: 'weapon_attack' }, effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'chain_attack', config: { ...config } }] }] }
}

export function sideWeaponAbility(id: string, config: SideWeaponConfig): AbilityDefinition {
  return { id, trigger: { kind: 'weapon_attack' }, effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'side_weapon', config: { ...config } }] }] }
}

export function barrageAbility(id: string, config: BarrageAttackConfig): AbilityDefinition {
  return { id, trigger: { kind: 'weapon_attack' }, effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'barrage_attack', config: { ...config } }] }] }
}

export function linePierceAbility(id: string, config: LinePierceConfig): AbilityDefinition {
  return { id, trigger: { kind: 'weapon_attack' }, effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'line_pierce', config: { ...config } }] }] }
}

export function coneAttackAbility(id: string, config: ConeAttackConfig): AbilityDefinition {
  return { id, trigger: { kind: 'weapon_attack' }, effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'cone_attack', config: { ...config } }] }] }
}

export function beamAttackAbility(id: string, config: BeamAttackConfig): AbilityDefinition {
  return { id, trigger: { kind: 'weapon_attack' }, effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'beam_attack', config: { ...config } }] }] }
}
