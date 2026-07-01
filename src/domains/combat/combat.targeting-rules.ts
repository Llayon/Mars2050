import type { SimUnit } from './combat.sim.types'

export interface WeaponTargetingCapability {
  canTargetAir?: boolean
}

export function canTargetUnit(attacker: Pick<SimUnit, 'canTargetAir'>, target: Pick<SimUnit, 'isFlying'>): boolean {
  return !target.isFlying || attacker.canTargetAir
}

export function canWeaponTargetUnit(
  attacker: Pick<SimUnit, 'canTargetAir'>,
  target: Pick<SimUnit, 'isFlying'>,
  weapon?: WeaponTargetingCapability
): boolean {
  return !target.isFlying || weapon?.canTargetAir === true || attacker.canTargetAir
}
