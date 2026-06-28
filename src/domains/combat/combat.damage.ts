import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'
import { getStatusValue } from './combat.status'

export interface CombatDamageResult {
  damage: number
  isShieldHit: boolean
  shieldDamage: number
  shieldBroken: boolean
  blockedDamage: number
  lifesteal: number
}

/**
 * Applies attack damage through defense, status modifiers, shields, execute, and lifesteal.
 * @param attacker Unit dealing damage
 * @param target Unit receiving damage
 * @param rawDamage Damage before target defense
 * @param actions Optional replay action sink for detailed damage events
 * @returns final HP damage and shield-hit flag
 */
export function applyCombatDamage(
  attacker: SimUnit,
  target: SimUnit,
  rawDamage: number,
  actions?: BattleAction[]
): CombatDamageResult {
  const raw = Math.floor(rawDamage)
  if (raw <= 0) return createDamageResult()

  const defense = getEffectiveDefense(target)
  let damage = Math.max(1, raw - defense)
  damage = applyOutputSuppression(attacker, damage)

  if (target.isFlying && attacker.antiAirDamageMult) damage = Math.floor(damage * attacker.antiAirDamageMult)
  if (!target.isFlying && attacker.groundDamageMult) damage = Math.floor(damage * attacker.groundDamageMult)
  if (target.isMoving && target.damageReductionWhileMoving) {
    damage = Math.floor(damage * (1 - target.damageReductionWhileMoving))
  }

  damage = applyStatusDamageModifiers(target, damage)
  const blockedDamage = Math.max(0, raw - damage)
  const shieldResult = applyShield(target, damage)
  damage = shieldResult.damage

  if (attacker.executeThreshold && target.hp <= attacker.executeThreshold) damage = target.hp
  let lifesteal = 0
  if (attacker.lifestealMult && damage > 0) {
    lifesteal = Math.floor(damage * attacker.lifestealMult)
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal)
  }
  if (damage > 0) target.hp -= damage

  const result = {
    ...shieldResult,
    damage,
    blockedDamage,
    lifesteal,
  }
  emitDamageActions(attacker, target, result, actions)
  return result
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
  if (target.shield <= 0) return createDamageResult({ damage })

  const currentShield = target.shield
  if (target.shield >= damage) {
    target.shield -= damage
    return createDamageResult({
      damage: 0,
      isShieldHit: true,
      shieldDamage: damage,
      shieldBroken: target.shield === 0,
    })
  }

  target.shield = 0
  return createDamageResult({
    damage: damage - currentShield,
    isShieldHit: true,
    shieldDamage: currentShield,
    shieldBroken: true,
  })
}

function createDamageResult(overrides: Partial<CombatDamageResult> = {}): CombatDamageResult {
  return {
    damage: 0,
    isShieldHit: false,
    shieldDamage: 0,
    shieldBroken: false,
    blockedDamage: 0,
    lifesteal: 0,
    ...overrides,
  }
}

function emitDamageActions(
  attacker: SimUnit,
  target: SimUnit,
  result: CombatDamageResult,
  actions?: BattleAction[]
): void {
  if (!actions) return

  if (result.blockedDamage > 0) {
    actions.push({ unitId: target.id, type: 'unit_blocked_damage', targetId: attacker.id, damage: result.blockedDamage })
  }
  if (result.shieldDamage > 0) {
    actions.push({ unitId: attacker.id, type: 'shield_damage', targetId: target.id, damage: result.shieldDamage, isShieldHit: true })
  }
  if (result.shieldBroken) {
    actions.push({ unitId: attacker.id, type: 'shield_break', targetId: target.id })
  }
  if (result.damage > 0) {
    actions.push({ unitId: attacker.id, type: 'damage', targetId: target.id, damage: result.damage })
  }
  if (result.lifesteal > 0) {
    actions.push({ unitId: attacker.id, type: 'lifesteal', targetId: attacker.id, damage: result.lifesteal })
  }
}
