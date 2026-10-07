export * from '@mars2050/combat-core/combat.ability-config'
import {
  displaceAbility as coreDisplaceAbility,
  sideWeaponAbility as coreSideWeaponAbility,
} from '@mars2050/combat-core/combat.ability-config'
import type { AbilityDefinition } from '@mars2050/combat-core/combat.ability.types'
import type { SideWeaponConfig } from './combat.primitives'

export function displaceAbility(
  id: string,
  mode: 'pull' | 'knockback',
  radius: number,
  strength: number,
  maxTargets?: number,
): AbilityDefinition {
  return coreDisplaceAbility(id, mode, radius * 40, strength * 40, maxTargets)
}

export function sideWeaponAbility(id: string, config: SideWeaponConfig): AbilityDefinition {
  return coreSideWeaponAbility(id, {
    ...config,
    range: config.range * 40,
  })
}
