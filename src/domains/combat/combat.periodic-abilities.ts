import type { BattleAction } from './combat.actions'
import { applyCombatDamage } from './combat.damage'
import { applyConfiguredTargetMark } from './combat.mark'
import { spawnCombatUnits } from './combat.spawn'
import { applyStatus, cleanseStatuses } from './combat.status'
import type { PeriodicAbilityPayload, RuntimePeriodicAbility, SimHazard, SimUnit } from './combat.sim.types'
import { getDistance, PRNG } from './combat.utils'

export interface PeriodicAbilityContext {
  units: SimUnit[]
  hazards: SimHazard[]
  actions: BattleAction[]
  rng: PRNG
  onUnitDeath?: (target: SimUnit, source: SimUnit) => void
}

export function processPeriodicAbilities(tick: number, context: PeriodicAbilityContext): void {
  const sources = context.units
    .filter(unit => !unit.isDead && (unit.periodicAbilities?.length ?? 0) > 0)
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const source of sources) {
    for (const ability of source.periodicAbilities ?? []) {
      if (!canUseAbility(tick, ability)) continue
      const target = selectAbilityTarget(source, ability, context.units)
      if (!target) continue
      ability.chargesRemaining = ability.chargesRemaining === undefined ? undefined : ability.chargesRemaining - 1
      ability.nextTick = tick + Math.max(1, ability.intervalTicks)
      context.actions.push({ unitId: source.id, type: 'periodic_ability', targetId: target.id, statusType: ability.id })
      applyAbilityPayload(source, target, ability.payload, context, tick, ability.id)
    }
  }
}

function canUseAbility(tick: number, ability: RuntimePeriodicAbility): boolean {
  return tick >= ability.nextTick && (ability.chargesRemaining === undefined || ability.chargesRemaining > 0)
}

function selectAbilityTarget(source: SimUnit, ability: RuntimePeriodicAbility, units: SimUnit[]): SimUnit | null {
  const policy = ability.targetPolicy ?? 'current_target'
  if (policy === 'self') return source
  if (policy === 'ally_lowest_hp') return selectLowestHpAlly(source, units)

  const current = units.find(unit => unit.id === source.attackTargetId)
  if (policy === 'current_target' && current && isAbilityEnemy(source, current, ability)) return current

  const candidates = units.filter(unit => isAbilityEnemy(source, unit, ability) && matchesPolicy(unit, policy))
  return selectNearest(source, candidates)
}

function isAbilityEnemy(source: SimUnit, target: SimUnit, ability: RuntimePeriodicAbility): boolean {
  if (target.isDead || target.team === source.team) return false
  return !target.isFlying || ability.canTargetAir === true || source.canTargetAir
}

function matchesPolicy(target: SimUnit, policy: RuntimePeriodicAbility['targetPolicy']): boolean {
  if (policy === 'nearest_air') return target.isFlying
  if (policy === 'nearest_ground') return !target.isFlying
  return true
}

function selectLowestHpAlly(source: SimUnit, units: SimUnit[]): SimUnit | null {
  const allies = units
    .filter(unit => !unit.isDead && unit.team === source.team && unit.id !== source.id && unit.hp < unit.maxHp)
    .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.id.localeCompare(b.id))
  return allies[0] ?? null
}

function selectNearest(source: SimUnit, candidates: SimUnit[]): SimUnit | null {
  let selected: SimUnit | null = null
  for (const candidate of candidates) {
    if (!selected || isNearer(source, candidate, selected)) selected = candidate
  }
  return selected
}

function isNearer(source: SimUnit, candidate: SimUnit, current: SimUnit): boolean {
  const candidateDistance = getDistance(source.x, source.y, candidate.x, candidate.y)
  const currentDistance = getDistance(source.x, source.y, current.x, current.y)
  return candidateDistance !== currentDistance ? candidateDistance < currentDistance : candidate.id < current.id
}

function applyAbilityPayload(source: SimUnit, target: SimUnit, payload: PeriodicAbilityPayload, context: PeriodicAbilityContext, tick: number, abilityId: string): void {
  if (payload.kind === 'hazard') {
    context.hazards.push({
      id: `periodic_${source.id}_${abilityId}_${tick}`,
      team: source.team,
      type: payload.hazardType,
      x: target.x,
      y: target.y,
      radius: payload.radius,
      damagePerTick: payload.damagePerTick ?? 0,
      duration: payload.duration,
      statusEffects: payload.statusEffects?.map(status => ({ ...status })),
    })
    context.actions.push({ unitId: source.id, type: 'hazard_spawn', targetId: target.id, statusType: payload.hazardType, radius: payload.radius })
    return
  }

  if (payload.kind === 'shield') {
    const granted = Math.max(0, Math.floor(payload.amount))
    target.maxShield = Math.max(target.maxShield, target.shield + granted)
    target.shield += granted
    context.actions.push({ unitId: source.id, type: 'shield_apply', targetId: target.id, damage: granted })
    return
  }

  if (payload.kind === 'spawn') {
    spawnCombatUnits(source, target, { ...payload, sourceKey: abilityId }, context.units, context.actions, context.rng, 'periodic')
    return
  }

  const targets = getPayloadTargets(source, target, payload, context.units)
  for (const payloadTarget of targets) {
    if (payload.kind === 'damage') {
      const result = applyCombatDamage(source, payloadTarget, payload.amount, context.actions, {
        units: context.units,
        hazards: context.hazards,
        onUnitDeath: unit => context.onUnitDeath?.(unit, source),
      })
      if (result.intercepted) continue
      if (payloadTarget.hp <= 0 && !payloadTarget.isDead) context.onUnitDeath?.(payloadTarget, source)
      for (const status of payload.statusEffects ?? []) applyStatus(payloadTarget, { ...status, sourceUnitId: source.id }, context.actions)
    } else if (payload.kind === 'status') {
      for (const status of payload.effects) applyStatus(payloadTarget, { ...status, sourceUnitId: source.id }, context.actions)
    } else if (payload.kind === 'heal') {
      applyPeriodicHeal(source, payloadTarget, payload, context.actions)
    } else if (payload.kind === 'mark') {
      applyConfiguredTargetMark(source, payloadTarget, payload.mark, context.actions)
    }
  }
}

function getPayloadTargets(source: SimUnit, target: SimUnit, payload: PeriodicAbilityPayload, units: SimUnit[]): SimUnit[] {
  if (payload.kind === 'heal') return getHealTargets(source, target, payload, units)
  if (payload.kind !== 'damage' && payload.kind !== 'mark') return [target]
  if (payload.radius === undefined) return [target]
  return units
    .filter(unit => !unit.isDead && unit.team !== source.team && getDistance(target.x, target.y, unit.x, unit.y) <= payload.radius!)
    .sort((a, b) => a.id.localeCompare(b.id))
}

function getHealTargets(source: SimUnit, target: SimUnit, payload: Extract<PeriodicAbilityPayload, { kind: 'heal' }>, units: SimUnit[]): SimUnit[] {
  if (payload.radius === undefined) return [target]
  return units
    .filter(unit => !unit.isDead && unit.team === source.team && getDistance(source.x, source.y, unit.x, unit.y) <= payload.radius!)
    .sort((a, b) => a.id.localeCompare(b.id))
}

function applyPeriodicHeal(source: SimUnit, target: SimUnit, payload: Extract<PeriodicAbilityPayload, { kind: 'heal' }>, actions: BattleAction[]): void {
  const amount = payload.amount !== undefined ? Math.max(0, Math.floor(payload.amount)) : Math.max(1, Math.floor(target.maxHp * (payload.percentMaxHp ?? 0)))
  const before = target.hp
  target.hp = Math.min(target.maxHp, target.hp + amount)
  if (target.hp > before) actions.push({ unitId: source.id, type: 'heal', targetId: target.id, damage: target.hp - before })
  if (payload.cleanse) cleanseStatuses(target, payload.cleanse, actions)
}
