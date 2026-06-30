import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'
import { getMarkedDamageMultiplier, getMarkedExecuteThreshold } from './combat.mark'
import { getPercentHpDamage } from './combat.percent-damage'
import { tryInterceptProjectile } from './combat.projectile-defense'
import { getStatusValue } from './combat.status'
import { getDistance } from './combat.utils'

export interface CombatDamageResult {
  damage: number
  sharedDamage: number
  sharedDamageEvents: { targetId: string; damage: number }[]
  isShieldHit: boolean
  shieldDamage: number
  shieldBroken: boolean
  blockedDamage: number
  lifesteal: number
  intercepted: boolean
}

export interface CombatDamageContext {
  units?: SimUnit[]
  onUnitDeath?: (unit: SimUnit) => void
  allowPercentHpDamage?: boolean
  interceptable?: boolean
}

/**
 * Applies attack damage through defense, status modifiers, shields, execute, and lifesteal.
 * @param attacker Unit dealing damage
 * @param target Unit receiving damage
 * @param rawDamage Damage before target defense
 * @param actions Optional replay action sink for detailed damage events
 * @param context Optional unit context for defensive primitives
 * @returns final HP damage and shield-hit flag
 */
export function applyCombatDamage(
  attacker: SimUnit,
  target: SimUnit,
  rawDamage: number,
  actions?: BattleAction[],
  context: CombatDamageContext = {}
): CombatDamageResult {
  const baseRaw = Math.floor(rawDamage)
  if (baseRaw <= 0) return createDamageResult()
  const percentHpDamage = context.allowPercentHpDamage === false ? 0 : getPercentHpDamage(attacker, target)
  const raw = baseRaw + percentHpDamage
  if (percentHpDamage > 0 && actions) {
    actions.push({ unitId: attacker.id, type: 'percent_hp_damage', targetId: target.id, value: percentHpDamage })
  }
  if (context.interceptable && context.units && tryInterceptProjectile(attacker, target, raw, context.units, actions)) {
    return createDamageResult({ blockedDamage: raw, intercepted: true })
  }

  const defense = getEffectiveDefense(target)
  let damage = Math.max(1, raw - defense)
  damage = applyOutputSuppression(attacker, damage)

  if (target.isFlying && attacker.antiAirDamageMult) damage = Math.floor(damage * attacker.antiAirDamageMult)
  if (!target.isFlying && attacker.groundDamageMult) damage = Math.floor(damage * attacker.groundDamageMult)
  if (target.isMoving && target.damageReductionWhileMoving) {
    damage = Math.floor(damage * (1 - target.damageReductionWhileMoving))
  }

  damage = applyStatusDamageModifiers(target, damage)
  damage = applyMarkDamageModifier(attacker, target, damage)
  const blockedDamage = Math.max(0, raw - damage)
  const shieldResult = applyShield(target, damage)
  damage = shieldResult.damage
  const reactiveArmorBlock = applyReactiveArmor(target, damage)
  damage -= reactiveArmorBlock
  const shareResult = applyDamageSharing(target, damage, context)
  damage = shareResult.damage

  const executeThreshold = Math.max(attacker.executeThreshold ?? 0, getMarkedExecuteThreshold(attacker, target))
  if (executeThreshold > 0 && target.hp <= executeThreshold) damage = target.hp
  let lifesteal = 0
  if (attacker.lifestealMult && damage + shareResult.sharedDamage > 0) {
    lifesteal = Math.floor((damage + shareResult.sharedDamage) * attacker.lifestealMult)
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal)
  }
  if (damage > 0) target.hp -= damage

  const result = {
    ...shieldResult,
    damage,
    sharedDamage: shareResult.sharedDamage,
    sharedDamageEvents: shareResult.events,
    blockedDamage: blockedDamage + reactiveArmorBlock,
    lifesteal,
  }
  emitDamageActions(attacker, target, result, actions)
  return result
}

function applyMarkDamageModifier(attacker: SimUnit, target: SimUnit, damage: number): number {
  const multiplier = getMarkedDamageMultiplier(attacker, target)
  if (multiplier <= 0) return damage
  return Math.max(0, Math.floor(damage * (1 + multiplier)))
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

function applyDamageSharing(target: SimUnit, damage: number, context: CombatDamageContext): { damage: number; sharedDamage: number; events: { targetId: string; damage: number }[] } {
  const ratio = Math.max(0, Math.min(0.9, target.damageShareRatio ?? 0))
  if (damage <= 0 || ratio <= 0 || !target.damageShareRadius || !context.units) return { damage, sharedDamage: 0, events: [] }

  const recipients = context.units
    .filter(unit => !unit.isDead && unit.team === target.team && unit.id !== target.id && getDistance(unit.x, unit.y, target.x, target.y) <= target.damageShareRadius!)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, Math.max(1, target.damageShareMaxTargets ?? Number.MAX_SAFE_INTEGER))
  if (recipients.length === 0) return { damage, sharedDamage: 0, events: [] }

  const shareBudget = Math.floor(damage * ratio)
  const events = distributeSharedDamage(shareBudget, recipients, context)
  const sharedDamage = events.reduce((sum, event) => sum + event.damage, 0)
  return { damage: damage - sharedDamage, sharedDamage, events }
}

function distributeSharedDamage(shareBudget: number, recipients: SimUnit[], context: CombatDamageContext): { targetId: string; damage: number }[] {
  if (shareBudget <= 0) return []
  const baseDamage = Math.floor(shareBudget / recipients.length)
  let remainder = shareBudget % recipients.length
  const events: { targetId: string; damage: number }[] = []

  for (const recipient of recipients) {
    const damage = baseDamage + (remainder > 0 ? 1 : 0)
    remainder = Math.max(0, remainder - 1)
    if (damage <= 0) continue

    recipient.hp -= damage
    events.push({ targetId: recipient.id, damage })
    if (recipient.hp <= 0 && !recipient.isDead) {
      if (context.onUnitDeath) context.onUnitDeath(recipient)
      else recipient.isDead = true
    }
  }

  return events
}

function applyReactiveArmor(target: SimUnit, damage: number): number {
  if (damage <= 0 || !target.reactiveArmorCharges || !target.reactiveArmorBlock) return 0

  target.reactiveArmorCharges--
  return Math.min(damage, Math.max(0, Math.floor(target.reactiveArmorBlock)))
}

function createDamageResult(overrides: Partial<CombatDamageResult> = {}): CombatDamageResult {
  return {
    damage: 0,
    isShieldHit: false,
    shieldDamage: 0,
    shieldBroken: false,
    sharedDamage: 0,
    sharedDamageEvents: [],
    blockedDamage: 0,
    lifesteal: 0,
    intercepted: false,
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
  for (const event of result.sharedDamageEvents) {
    actions.push({ unitId: attacker.id, type: 'damage_share', targetId: event.targetId, damage: event.damage })
  }
  if (result.lifesteal > 0) {
    actions.push({ unitId: attacker.id, type: 'lifesteal', targetId: attacker.id, damage: result.lifesteal })
  }
}
