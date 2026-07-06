import type { BattleAction } from './combat.actions'
import { applyCombatDamage } from './combat.damage'
import { applyTargetMark } from './combat.mark'
import { applyStatus } from './combat.status'
import { handleDeath } from './combat.systems.utils'
import type { SimHazard, SimUnit } from './combat.sim.types'
import { getDistance, PRNG } from './combat.utils'

export function getConditionalAttackTargets(source: SimUnit, target: SimUnit, units: SimUnit[]): SimUnit[] {
  const config = source.conditionalAttackMode
  if (!config) return []
  const candidates = units
    .filter(unit => !unit.isDead && unit.team !== source.team && getDistance(target.x, target.y, unit.x, unit.y) <= config.radius)
    .sort((a, b) => getDistance(target.x, target.y, a.x, a.y) - getDistance(target.x, target.y, b.x, b.y) || a.id.localeCompare(b.id))
  if (candidates.length < config.minTargets) return []
  return candidates.filter(unit => unit.id !== target.id)
}

export function getConditionalAttackDamage(source: SimUnit): number {
  return Math.max(0, Math.floor(source.attack * (source.conditionalAttackMode?.damageMultiplier ?? 0)))
}

export function emitConditionalAttack(source: SimUnit, target: SimUnit, actions: BattleAction[]): void {
  actions.push({ unitId: source.id, type: 'conditional_attack_mode', targetId: target.id, radius: source.conditionalAttackMode?.radius, value: source.conditionalAttackMode?.damageMultiplier })
}

export function getSweepTargets(source: SimUnit, target: SimUnit, units: SimUnit[]): { target: SimUnit; multiplier: number }[] {
  const config = source.sweepAttack
  if (!config) return []
  return units
    .filter(unit => !unit.isDead && unit.team !== source.team && unit.id !== target.id && Math.abs(unit.x - target.x) <= config.width && getDistance(source.x, source.y, unit.x, unit.y) <= source.range)
    .sort((a, b) => Math.abs(a.y - target.y) - Math.abs(b.y - target.y) || a.id.localeCompare(b.id))
    .slice(0, config.maxTargets ?? Number.MAX_SAFE_INTEGER)
    .map(unit => ({ target: unit, multiplier: config.damageMultiplier * (config.sizeBonusMultiplier?.[unit.size] ?? 1) }))
}

export function processConditionalAttack(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  const targets = getConditionalAttackTargets(unit, target, units)
  if (targets.length === 0) return

  emitConditionalAttack(unit, target, actions)
  const damage = getConditionalAttackDamage(unit)
  for (const secondary of targets) applyPrimitiveSecondaryHit(unit, secondary, damage, units, actions, hazards, rng)
}

export function processSweepAttack(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  for (const hit of getSweepTargets(unit, target, units)) {
    actions.push({ unitId: unit.id, type: 'sweep_hit', targetId: hit.target.id, value: hit.multiplier })
    applyPrimitiveSecondaryHit(unit, hit.target, Math.floor(unit.attack * hit.multiplier), units, actions, hazards, rng)
  }
}

function applyPrimitiveSecondaryHit(unit: SimUnit, target: SimUnit, damage: number, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  applyCombatDamage(unit, target, damage, actions, { units, hazards, allowPercentHpDamage: false, onUnitDeath: dead => handleDeath(dead, unit, units, actions, hazards, rng) })
  if (unit.appliesEmp) applyStatus(target, { type: 'emp', duration: 30, sourceUnitId: unit.id }, actions)
  for (const status of unit.statusOnHit ?? []) applyStatus(target, { ...status, sourceUnitId: unit.id }, actions)
  applyTargetMark(unit, target, actions)
  if (target.hp <= 0 && !target.isDead) handleDeath(target, unit, units, actions, hazards, rng)
}
