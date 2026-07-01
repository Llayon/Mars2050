import type { BattleAction } from './combat.actions'
import type { SimUnit, StatusEffect, StatusType } from './combat.sim.types'
import { chooseHackControlMode, isHackActionBlocked, normalizeHackControlMode } from './combat.control'
import { getStanceRangeMultiplier } from './combat.stance'

const ACTION_BLOCKING_STATUSES = new Set<StatusType>(['emp'])
export const HARMFUL_STATUS_TYPES: StatusType[] = [
  'emp',
  'slow',
  'burn',
  'acid',
  'vulnerable',
  'range_suppressed',
  'revealed',
  'hacked',
  'output_suppressed',
  'accuracy_reduced',
  'armor_broken',
  'degeneration',
]

/**
 * Applies or refreshes a status effect using deterministic stack identity.
 * @param target The unit receiving the status
 * @param effect The status payload to apply
 * @param actions Optional replay action sink
 * @returns true when a new stack was created, false when an existing stack was refreshed
 */
export function applyStatus(target: SimUnit, effect: StatusEffect, actions?: BattleAction[]): boolean {
  const normalized = normalizeStatus(effect)
  if (normalized.duration <= 0) return false
  if (isStatusBlockedByImmunity(target, normalized.type)) {
    actions?.push({ unitId: target.id, type: 'status_immune', statusType: normalized.type })
    return false
  }

  const existing = target.statusEffects.find(status => getStatusStackId(status) === getStatusStackId(normalized))
  if (existing) {
    existing.duration = Math.max(existing.duration, normalized.duration)
    existing.value = chooseStatusValue(existing.type, existing.value, normalized.value)
    existing.controlMode = chooseHackControlMode(existing.controlMode, normalized.controlMode)
    actions?.push(createStatusApplyAction(target.id, existing))
    return false
  }

  target.statusEffects.push(normalized)
  actions?.push(createStatusApplyAction(target.id, normalized))
  return true
}

function isStatusBlockedByImmunity(target: SimUnit, type: StatusType): boolean {
  if (type === 'status_immunity') return false
  return HARMFUL_STATUS_TYPES.includes(type) && hasStatus(target, 'status_immunity')
}

/**
 * Ticks unit statuses once and emits deterministic expire actions.
 * @param unit Unit whose statuses should tick
 * @param actions Replay action sink
 */
export function tickStatuses(unit: SimUnit, actions: BattleAction[]): void {
  for (let i = unit.statusEffects.length - 1; i >= 0; i--) {
    const effect = unit.statusEffects[i]
    effect.duration--
    if (effect.duration > 0 && effect.duration % 10 === 0) applyPeriodicStatusEffect(unit, effect, actions)
    if (effect.duration > 0) continue

    unit.statusEffects.splice(i, 1)
    actions.push({ unitId: unit.id, type: 'status_expire', statusType: effect.type })
  }
}

/**
 * Removes matching statuses and emits cleanse actions.
 * @param unit Unit to cleanse
 * @param types Optional allow-list. If omitted, all statuses are removed.
 * @param actions Optional replay action sink
 * @returns number of removed status stacks
 */
export function cleanseStatuses(unit: SimUnit, types?: StatusType[], actions?: BattleAction[]): number {
  const allowed = types ? new Set(types) : undefined
  let removed = 0

  for (let i = unit.statusEffects.length - 1; i >= 0; i--) {
    const effect = unit.statusEffects[i]
    if (allowed && !allowed.has(effect.type)) continue

    unit.statusEffects.splice(i, 1)
    removed++
    actions?.push({ unitId: unit.id, type: 'status_cleanse', statusType: effect.type })
  }

  return removed
}

/**
 * Checks whether a unit has an active status.
 * @param unit Unit to inspect
 * @param type Status type to find
 * @returns true when at least one matching stack is active
 */
export function hasStatus(unit: SimUnit, type: StatusType): boolean {
  return unit.statusEffects.some(effect => effect.type === type && effect.duration > 0)
}

/**
 * Checks whether a unit has any active status from a list.
 * @param unit Unit to inspect
 * @param types Status types to find
 * @returns true when at least one matching stack is active
 */
export function hasAnyStatus(unit: SimUnit, types: StatusType[]): boolean {
  return types.some(type => hasStatus(unit, type))
}

/**
 * Reads the strongest value for a status type.
 * @param unit Unit to inspect
 * @param type Status type to read
 * @returns status value when present, otherwise undefined
 */
export function getStatusValue(unit: SimUnit, type: StatusType): number | undefined {
  let value: number | undefined
  for (const effect of unit.statusEffects) {
    if (effect.type !== type || effect.duration <= 0) continue
    value = chooseStatusValue(type, value, effect.value)
  }
  return value
}

/**
 * Determines whether statuses currently block active combat actions.
 * @param unit Unit to inspect
 * @returns true when attacks, heals, or spawns should be skipped
 */
export function isActionBlockedByStatus(unit: SimUnit): boolean {
  return unit.statusEffects.some(effect => ACTION_BLOCKING_STATUSES.has(effect.type) && effect.duration > 0) ||
    isHackActionBlocked(unit)
}

/**
 * Computes movement speed multiplier from active movement statuses.
 * @param unit Unit to inspect
 * @returns multiplier applied to base movement speed
 */
export function getMovementSpeedMultiplier(unit: SimUnit): number {
  const slow = getStatusValue(unit, 'slow')
  const haste = getStatusValue(unit, 'haste')
  let multiplier = 1

  if (slow !== undefined) multiplier *= slow <= 1 ? Math.max(0, slow) : Math.max(0, 1 - slow)
  if (haste !== undefined) multiplier *= haste >= 1 ? haste : 1 + Math.max(0, haste)

  return multiplier
}

/**
 * Computes attack and support range after active range-control statuses.
 * @param unit Unit to inspect
 * @returns effective action range in simulation units
 */
export function getEffectiveActionRange(unit: SimUnit): number {
  const boost = getStatusValue(unit, 'range_boost')
  const suppression = getStatusValue(unit, 'range_suppressed')
  let effectiveRange = unit.range * getStanceRangeMultiplier(unit)

  if (boost !== undefined && boost > 0) {
    const boostMultiplier = boost >= 1 ? boost : 1 + boost
    effectiveRange *= Math.min(3, boostMultiplier)
  }
  if (suppression === undefined || suppression <= 0) return effectiveRange

  const reduction = suppression <= 1 ? suppression : suppression / 100
  return Math.max(0, effectiveRange * Math.max(0.05, 1 - Math.min(0.95, reduction)))
}

function normalizeStatus(effect: StatusEffect): StatusEffect {
  return {
    ...effect,
    duration: Math.max(0, Math.floor(effect.duration)),
    value: effect.value === undefined ? undefined : Number(effect.value),
    controlMode: normalizeHackControlMode(effect.controlMode),
  }
}

function createStatusApplyAction(unitId: string, effect: StatusEffect): BattleAction {
  const action: BattleAction = { unitId, type: 'status_apply', statusType: effect.type, value: effect.value }
  if (effect.controlMode !== undefined) action.controlMode = effect.controlMode
  return action
}

function getStatusStackId(effect: StatusEffect): string {
  return `${effect.type}:${effect.stackKey ?? effect.sourceUnitId ?? 'global'}`
}

function chooseStatusValue(type: StatusType, current?: number, next?: number): number | undefined {
  if (current === undefined) return next
  if (next === undefined) return current
  if (type === 'slow' && current <= 1 && next <= 1) return Math.min(current, next)
  return Math.max(current, next)
}

function applyPeriodicStatusEffect(unit: SimUnit, effect: StatusEffect, actions: BattleAction[]): void {
  if (unit.isDead) return

  if (effect.type === 'regen') {
    const heal = Math.max(1, Math.floor(effect.value ?? unit.maxHp * 0.02))
    unit.hp = Math.min(unit.maxHp, unit.hp + heal)
    actions.push({ unitId: effect.sourceUnitId ?? effect.type, type: 'status_tick', targetId: unit.id, damage: heal, statusType: effect.type })
    return
  }

  const damage = getPeriodicStatusDamage(unit, effect)
  if (damage <= 0) return

  unit.hp -= damage
  actions.push({ unitId: effect.sourceUnitId ?? effect.type, type: 'status_tick', targetId: unit.id, damage, statusType: effect.type })

  if (unit.hp <= 0 && !unit.isDead) {
    unit.isDead = true
    actions.push({ unitId: unit.id, type: 'die' })
  }
}

function getPeriodicStatusDamage(unit: SimUnit, effect: StatusEffect): number {
  if (effect.type === 'burn') return Math.max(1, Math.floor(effect.value ?? 3))
  if (effect.type === 'acid') return Math.max(1, Math.floor(effect.value ?? unit.maxHp * 0.02))
  if (effect.type === 'degeneration') {
    if (effect.value === undefined) return Math.max(1, Math.floor(unit.maxHp * 0.03))
    return Math.max(1, Math.floor(effect.value <= 1 ? unit.maxHp * effect.value : effect.value))
  }
  return 0
}
