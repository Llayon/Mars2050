import type { BattleAction } from './combat.actions'
import type { SimUnit, TargetMarkConfig } from './combat.sim.types'

/**
 * Applies a source-specific target mark from an attacker's config.
 * @param attacker Unit applying the mark
 * @param target Unit receiving the mark
 * @param actions Optional replay action sink
 * @returns true when a mark was applied
 */
export function applyTargetMark(attacker: SimUnit, target: SimUnit, actions?: BattleAction[]): boolean {
  if (!attacker.markOnHit || target.isDead) return false

  return applyConfiguredTargetMark(attacker, target, attacker.markOnHit, actions)
}

export function applyConfiguredTargetMark(attacker: SimUnit, target: SimUnit, mark: TargetMarkConfig, actions?: BattleAction[]): boolean {
  if (target.isDead) return false
  target.targetMark = { ...mark, sourceUnitId: attacker.id }
  actions?.push({
    unitId: attacker.id,
    type: 'target_mark',
    targetId: target.id,
    value: target.targetMark.damageMultiplier ?? target.targetMark.executeThreshold ?? target.targetMark.focusPriority,
  })
  return true
}

/**
 * Ticks a target mark once and emits deterministic expiration.
 * @param unit Unit whose target mark should tick
 * @param actions Replay action sink
 */
export function tickTargetMark(unit: SimUnit, actions: BattleAction[]): void {
  if (!unit.targetMark) return

  unit.targetMark.duration--
  if (unit.targetMark.duration > 0) return

  const sourceUnitId = unit.targetMark.sourceUnitId
  unit.targetMark = undefined
  actions.push({ unitId: sourceUnitId, type: 'target_mark_expire', targetId: unit.id })
}

/**
 * Reads a mark damage multiplier that only benefits the mark source.
 * @param attacker Unit dealing damage
 * @param target Unit receiving damage
 * @returns damage multiplier bonus, or 0 when no matching mark is active
 */
export function getMarkedDamageMultiplier(attacker: SimUnit, target: SimUnit): number {
  const mark = target.targetMark
  if (!mark || mark.sourceUnitId !== attacker.id || mark.duration <= 0) return 0
  return Math.max(0, mark.damageMultiplier ?? 0)
}

/**
 * Reads a mark execute threshold that only benefits the mark source.
 * @param attacker Unit dealing damage
 * @param target Unit receiving damage
 * @returns execute threshold, or 0 when no matching mark is active
 */
export function getMarkedExecuteThreshold(attacker: SimUnit, target: SimUnit): number {
  const mark = target.targetMark
  if (!mark || mark.sourceUnitId !== attacker.id || mark.duration <= 0) return 0
  return Math.max(0, Math.floor(mark.executeThreshold ?? 0))
}
