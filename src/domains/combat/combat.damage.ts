import type { SimUnit } from './combat.sim.types'
import { getStatusValue } from './combat.status'

export interface CombatDamageResult {
  damage: number
  isShieldHit: boolean
}

/**
 * Applies attack damage through defense, status modifiers, shields, execute, and lifesteal.
 * @param attacker Unit dealing damage
 * @param target Unit receiving damage
 * @param rawDamage Damage before target defense
 * @returns final HP damage and shield-hit flag
 */
export function applyCombatDamage(attacker: SimUnit, target: SimUnit, rawDamage: number): CombatDamageResult {
  if (rawDamage <= 0) return { damage: 0, isShieldHit: false }

  const defense = getEffectiveDefense(target)
  let damage = Math.max(1, Math.floor(rawDamage) - defense)
  damage = applyOutputSuppression(attacker, damage)

  if (target.isFlying && attacker.antiAirDamageMult) damage = Math.floor(damage * attacker.antiAirDamageMult)
  if (!target.isFlying && attacker.groundDamageMult) damage = Math.floor(damage * attacker.groundDamageMult)
  if (target.isMoving && target.damageReductionWhileMoving) {
    damage = Math.floor(damage * (1 - target.damageReductionWhileMoving))
  }

  damage = applyStatusDamageModifiers(target, damage)
  const shieldResult = applyShield(target, damage)
  damage = shieldResult.damage

  if (attacker.executeThreshold && target.hp <= attacker.executeThreshold) damage = target.hp
  if (attacker.lifestealMult && damage > 0) {
    const heal = Math.floor(damage * attacker.lifestealMult)
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal)
  }
  if (damage > 0) target.hp -= damage

  return { damage, isShieldHit: shieldResult.isShieldHit }
}

function getEffectiveDefense(target: SimUnit): number {
  const armorBroken = getStatusValue(target, 'armor_broken') ?? 0
  const defenseReduction = armorBroken <= 1 ? target.defense * armorBroken : armorBroken
  return Math.max(0, target.defense - defenseReduction)
}

function applyStatusDamageModifiers(target: SimUnit, damage: number): number {
  const vulnerable = getStatusValue(target, 'vulnerable') ?? 0
  const reduction = getStatusValue(target, 'damage_reduction') ?? 0
  let result = damage

  if (vulnerable > 0) result = Math.floor(result * (1 + vulnerable))
  if (reduction > 0) result = Math.floor(result * Math.max(0, 1 - reduction))

  return Math.max(0, result)
}

function applyOutputSuppression(attacker: SimUnit, damage: number): number {
  const suppression = getStatusValue(attacker, 'output_suppressed') ?? 0
  if (suppression <= 0) return damage
  return Math.max(0, Math.floor(damage * Math.max(0, 1 - suppression)))
}

function applyShield(target: SimUnit, damage: number): CombatDamageResult {
  if (target.shield <= 0) return { damage, isShieldHit: false }

  if (target.shield >= damage) {
    target.shield -= damage
    return { damage: 0, isShieldHit: true }
  }

  target.shield = 0
  return { damage: 0, isShieldHit: true }
}
