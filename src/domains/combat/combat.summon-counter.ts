import { UNIT_TYPES } from './combat.config'
import type { SimUnit } from './combat.sim.types'

export function applySummonCounterDamage(attacker: SimUnit, target: SimUnit, damage: number): number {
  const multiplier = Math.max(1, attacker.summonCounterDamageMult ?? 1)
  if (multiplier <= 1 || !isSummonCounterTarget(target)) return damage
  return Math.floor(damage * multiplier)
}

export function isSummonCounterTarget(target: SimUnit): boolean {
  const tags = UNIT_TYPES[target.type as keyof typeof UNIT_TYPES]?.baseStats.combatTags ?? []
  return target.attackType === 'spawn' || target.summonOwnerId !== undefined || target.isTemporary === true || tags.includes('summoner')
}
