import {
  auraAbility,
  barrageAbility,
  beamAttackAbility,
  chainAttackAbility,
  coneAttackAbility,
  displaceAbility as coreDisplaceAbility,
  extractSupportAuras,
  linePierceAbility,
  markAbility,
  periodicAbility,
  sideWeaponAbility as coreSideWeaponAbility,
  splitFireAbility,
  statusAbility,
  type AbilityDefinition,
} from '@mars2050/combat-core'
import type { SideWeaponConfigContract as SideWeaponConfig } from '@mars2050/combat-core/contracts'

export {
  auraAbility,
  barrageAbility,
  beamAttackAbility,
  chainAttackAbility,
  coneAttackAbility,
  extractSupportAuras,
  linePierceAbility,
  markAbility,
  periodicAbility,
  splitFireAbility,
  statusAbility,
}
export type { AbilityDefinition }

/**
 * Mars adapter for displace ability: translates tile coordinates (1 tile = 40px)
 * to internal pixel arena coordinates.
 */
export function displaceAbility(
  id: string,
  mode: 'pull' | 'knockback',
  radius: number,
  strength: number,
  maxTargets?: number,
): AbilityDefinition {
  return coreDisplaceAbility(id, mode, radius * 40, strength * 40, maxTargets)
}

/**
 * Mars adapter for side weapon ability: translates tile range (1 tile = 40px)
 * to internal pixel arena coordinates.
 */
export function sideWeaponAbility(id: string, config: SideWeaponConfig): AbilityDefinition {
  return coreSideWeaponAbility(id, {
    ...config,
    range: (config.range ?? 0) * 40,
  })
}
