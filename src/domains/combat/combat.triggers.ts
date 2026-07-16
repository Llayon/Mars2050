import type { BattleAction } from './combat.actions'
import { applyCombatDamage } from './combat.damage'
import { applyFieldEffectAt } from './combat.field-effects'
import { getConfiguredPercentHpDamage } from './combat.percent-damage'
import { startReassembly } from './combat.reassembly'
import { spawnCombatUnits } from './combat.spawn'
import { applyStatus } from './combat.status'
import type { RuntimeTriggerEffect, SimHazard, SimUnit, TriggerPayload } from './combat.sim.types'
import { PRNG, getDistance } from './combat.utils'
import { applyHealing } from './combat.healing'

export interface TriggerContext {
  units: SimUnit[]
  hazards: SimHazard[]
  actions: BattleAction[]
  rng: PRNG
  tick?: number
  onUnitDeath?: (target: SimUnit, source: SimUnit) => void
}

export function tickTriggerCooldowns(unit: SimUnit): void {
  for (const trigger of unit.triggerEffects ?? []) {
    if (trigger.cooldownRemaining > 0) trigger.cooldownRemaining--
  }
}

export function processHpThresholdTriggers(unit: SimUnit, context: TriggerContext): void {
  for (const trigger of getTriggers(unit, 'hp_threshold')) {
    const threshold = trigger.threshold ?? 0
    const value = threshold <= 1 ? unit.hp / unit.maxHp : unit.hp
    if (value <= threshold) fireTrigger(unit, trigger, unit, unit, context)
  }
}

export function recordAttackTrigger(source: SimUnit, target: SimUnit, context: TriggerContext): void {
  for (const trigger of getTriggers(source, 'attack_count')) {
    trigger.counter++
    if (trigger.counter >= Math.max(1, trigger.count ?? 1)) fireTrigger(source, trigger, target, source, context)
  }
}

export function recordDamageTakenTrigger(attacker: SimUnit, target: SimUnit, damage: number, context: TriggerContext): void {
  if (damage <= 0) return
  for (const trigger of getTriggers(target, 'damage_taken')) {
    if (damage < Math.max(0, trigger.threshold ?? 0)) continue
    fireTrigger(target, trigger, attacker, attacker, context)
  }
}

export function processDeathTriggers(dead: SimUnit, killer: SimUnit, context: TriggerContext): void {
  for (const trigger of getTriggers(dead, 'death')) fireTrigger(dead, trigger, dead, killer, context)
}

export function processKillTriggers(killer: SimUnit, victim: SimUnit, context: TriggerContext): void {
  for (const trigger of getTriggers(killer, 'kill')) fireTrigger(killer, trigger, victim, killer, context)
}

function getTriggers(unit: SimUnit, event: RuntimeTriggerEffect['event']): RuntimeTriggerEffect[] {
  return (unit.triggerEffects ?? []).filter(trigger => trigger.event === event)
}

function fireTrigger(owner: SimUnit, trigger: RuntimeTriggerEffect, eventTarget: SimUnit, actor: SimUnit, context: TriggerContext): void {
  if (!canFireTrigger(trigger)) return
  trigger.fired = true
  trigger.counter = 0
  trigger.cooldownRemaining = trigger.cooldownTicks ?? 0
  if (trigger.triggersRemaining !== undefined) trigger.triggersRemaining--

  const target = resolveTarget(owner, eventTarget, actor, trigger.payload, context.units)
  context.actions.push({ unitId: owner.id, type: 'trigger_effect', targetId: target?.id, statusType: trigger.id })
  applyTriggerPayload(owner, target, eventTarget, trigger.payload, context)
}

function canFireTrigger(trigger: RuntimeTriggerEffect): boolean {
  if (trigger.cooldownRemaining > 0) return false
  if (!trigger.repeatable && trigger.fired) return false
  return trigger.triggersRemaining === undefined || trigger.triggersRemaining > 0
}

function resolveTarget(owner: SimUnit, eventTarget: SimUnit, actor: SimUnit, payload: TriggerPayload, units: SimUnit[]): SimUnit | null {
  if (payload.target === 'self') return owner
  if (payload.target === 'target' || payload.target === 'victim') return eventTarget
  if (payload.target === 'attacker' || payload.target === 'killer') return actor
  return selectNearestEnemy(owner, units)
}

function selectNearestEnemy(owner: SimUnit, units: SimUnit[]): SimUnit | null {
  let selected: SimUnit | null = null
  for (const unit of units) {
    if (unit.isDead || unit.team === owner.team) continue
    if (!selected || getDistance(owner.x, owner.y, unit.x, unit.y) < getDistance(owner.x, owner.y, selected.x, selected.y)) selected = unit
  }
  return selected
}

function applyTriggerPayload(owner: SimUnit, target: SimUnit | null, eventTarget: SimUnit, payload: TriggerPayload, context: TriggerContext): void {
  if (!target && payload.kind !== 'spawn') return

  if (payload.kind === 'status' && target) {
    applyStatus(target, { ...payload.status, sourceUnitId: owner.id }, context.actions)
    return
  }
  if (payload.kind === 'shield' && target) {
    const amount = Math.max(0, Math.floor(payload.amount))
    target.maxShield = Math.max(target.maxShield, target.shield + amount)
    target.shield += amount
    context.actions.push({ unitId: owner.id, type: 'shield_apply', targetId: target.id, damage: amount })
    return
  }
  if (payload.kind === 'heal' && target) {
    const amount = getHealAmount(payload, target, eventTarget)
    applyHealing(owner.id, target, amount, context.actions)
    return
  }
  if (payload.kind === 'damage' && target) {
    applyTriggerDamage(owner, target, payload, context)
    return
  }
  if (payload.kind === 'field' && target) {
    applyFieldEffectAt(owner, target, payload.field, context.units, context.hazards, context.actions, `trigger_${context.tick ?? 0}_${context.actions.length}`)
    return
  }
  if (payload.kind === 'cooldown_reset' && target) {
    target.actionCooldown = 0
    return
  }
  if (payload.kind === 'spawn') spawnTriggerUnits(owner, target ?? eventTarget, payload, context)
  if (payload.kind === 'delayed_reassembly' && target) startReassembly(target, payload, owner.id, context.actions)
}

function getHealAmount(payload: Extract<TriggerPayload, { kind: 'heal' }>, target: SimUnit, eventTarget: SimUnit): number {
  if (payload.amount !== undefined) return Math.max(0, Math.floor(payload.amount))
  if (payload.victimMaxHpPercent !== undefined) return Math.max(1, Math.floor(eventTarget.maxHp * payload.victimMaxHpPercent))
  return Math.max(1, Math.floor(target.maxHp * (payload.percentMaxHp ?? 0)))
}

function applyTriggerDamage(owner: SimUnit, target: SimUnit, payload: Extract<TriggerPayload, { kind: 'damage' }>, context: TriggerContext): void {
  const targets = payload.radius === undefined ? [target] : context.units
    .filter(unit => !unit.isDead && unit.team !== owner.team && getDistance(target.x, target.y, unit.x, unit.y) <= payload.radius!)
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const hit of targets) {
    const percentDamage = getConfiguredPercentHpDamage(hit, payload.percentHp)
    const damage = Math.max(0, Math.floor(payload.amount ?? 0)) + percentDamage
    if (percentDamage > 0) context.actions.push({ unitId: owner.id, type: 'percent_hp_damage', targetId: hit.id, value: percentDamage })
    applyCombatDamage(owner, hit, damage, context.actions, {
      units: context.units,
      hazards: context.hazards,
      allowPercentHpDamage: false,
      onUnitDeath: unit => context.onUnitDeath?.(unit, owner),
    })
    if (hit.hp <= 0 && !hit.isDead) context.onUnitDeath?.(hit, owner)
  }
}

function spawnTriggerUnits(owner: SimUnit, anchor: SimUnit, payload: Extract<TriggerPayload, { kind: 'spawn' }>, context: TriggerContext): void {
  spawnCombatUnits(owner, anchor, { ...payload, sourceKey: payload.unitType }, context.units, context.actions, context.rng, 'trigger')
}
