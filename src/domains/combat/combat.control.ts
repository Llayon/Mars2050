import type { MeleeEngagementState } from './combat.melee-engagement'
import { clearMeleeEngagementSlot, hasMeleeEngagementSlot } from './combat.melee-engagement'
import type { HackControlMode, SimUnit } from './combat.sim.types'
import { canTargetUnit } from './combat.targeting-rules'
import { getDistance } from './combat.utils'

const HACK_CONTROL_LOCK_TICKS = 6
const HACK_CONTROL_PRIORITY: Record<HackControlMode, number> = {
  disable: 0,
  redirect: 1,
  confuse: 2,
}

export interface HackControlTargetResult {
  handled: boolean
  target: SimUnit | null
}

export function normalizeHackControlMode(mode?: HackControlMode): HackControlMode | undefined {
  if (mode === 'disable' || mode === 'redirect' || mode === 'confuse') return mode
  return undefined
}

export function chooseHackControlMode(current?: HackControlMode, next?: HackControlMode): HackControlMode | undefined {
  if (!current) return next
  if (!next) return current
  return HACK_CONTROL_PRIORITY[next] > HACK_CONTROL_PRIORITY[current] ? next : current
}

export function getHackControlMode(unit: SimUnit): HackControlMode | null {
  let mode: HackControlMode | undefined
  for (const effect of unit.statusEffects) {
    if (effect.type !== 'hacked' || effect.duration <= 0) continue
    mode = chooseHackControlMode(mode, effect.controlMode ?? 'disable')
  }

  return mode ?? null
}

export function isHackActionBlocked(unit: SimUnit): boolean {
  const mode = getHackControlMode(unit)
  return mode !== null && (mode === 'disable' || !canUseHackControlTargeting(unit))
}

export function canAttackControlledTarget(unit: SimUnit, target: SimUnit): boolean {
  return unit.team === target.team && canUseHackControlTargeting(unit) && isAggressiveHackMode(getHackControlMode(unit))
}

export function selectHackControlTarget(
  unit: SimUnit,
  candidates: SimUnit[],
  meleeEngagement: MeleeEngagementState
): HackControlTargetResult {
  const mode = getHackControlMode(unit)
  if (mode === null) return { handled: false, target: null }
  if (mode === 'disable' || !canUseHackControlTargeting(unit)) return clearControlTarget(unit)

  let targets = candidates.filter(candidate => isHackControlCandidate(unit, candidate, mode))
  if (unit.range <= 60) targets = targets.filter(target => hasMeleeEngagementSlot(unit, target, meleeEngagement))

  const target = selectNearestControlTarget(unit, targets)
  if (!target) return clearControlTarget(unit)

  unit.attackTargetId = target.id
  unit.aggroLockTicks = HACK_CONTROL_LOCK_TICKS
  return { handled: true, target }
}

function clearControlTarget(unit: SimUnit): HackControlTargetResult {
  unit.attackTargetId = undefined
  unit.aggroLockTicks = 0
  clearMeleeEngagementSlot(unit)
  return { handled: true, target: null }
}

function canUseHackControlTargeting(unit: SimUnit): boolean {
  return unit.attack > 0 && unit.attackType !== 'heal' && unit.attackType !== 'spawn'
}

function isAggressiveHackMode(mode: HackControlMode | null): boolean {
  return mode === 'redirect' || mode === 'confuse'
}

function isHackControlCandidate(unit: SimUnit, candidate: SimUnit, mode: HackControlMode): boolean {
  if (candidate.isDead || candidate.id === unit.id || !canTargetUnit(unit, candidate)) return false
  if (isHiddenStealthEnemy(unit, candidate)) return false
  if (mode === 'redirect') return candidate.team === unit.team
  return true
}

function isHiddenStealthEnemy(unit: SimUnit, candidate: SimUnit): boolean {
  return candidate.team !== unit.team &&
    candidate.stealthUntilAttack === true &&
    !candidate.hasAttacked &&
    !candidate.statusEffects.some(effect => effect.type === 'revealed' && effect.duration > 0)
}

function selectNearestControlTarget(unit: SimUnit, candidates: SimUnit[]): SimUnit | null {
  let target: SimUnit | null = null
  for (const candidate of candidates) {
    if (!target || isBetterControlTarget(unit, candidate, target)) target = candidate
  }
  return target
}

function isBetterControlTarget(unit: SimUnit, candidate: SimUnit, current: SimUnit): boolean {
  const candidateDistance = getDistance(unit.x, unit.y, candidate.x, candidate.y)
  const currentDistance = getDistance(unit.x, unit.y, current.x, current.y)
  if (candidateDistance !== currentDistance) return candidateDistance < currentDistance
  if (candidate.hp !== current.hp) return candidate.hp < current.hp
  return candidate.id < current.id
}
