import type { MeleeEngagementState } from './combat.melee-engagement'
import { clearMeleeEngagementSlot, hasMeleeEngagementSlot } from './combat.melee-engagement'
import type { BattleAction } from './combat.actions'
import type { ControlBeamConfig, HackControlMode, SimUnit } from './combat.sim.types'
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

export function processControlBeams(units: SimUnit[], actions: BattleAction[]): void {
  const sources = units
    .filter(unit => !unit.isDead && unit.controlBeam)
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const source of sources) {
    const config = source.controlBeam
    if (!config) continue
    const targets = selectControlBeamTargets(source, config, units)
    breakStaleControlLinks(source, config, targets, units, actions)
    for (const target of targets) applyControlProgress(source, target, config, targets.length, actions)
  }

  for (const unit of units) {
    const progress = unit.controlProgress
    if (!progress) continue
    const source = units.find(candidate => candidate.id === progress.sourceUnitId)
    if (!source || source.isDead || unit.isDead) breakControlProgress(unit, actions)
  }
}

export function breakControlProgress(unit: SimUnit, actions?: BattleAction[]): boolean {
  const progress = unit.controlProgress
  if (!progress) return false
  unit.controlProgress = undefined
  actions?.push({ unitId: progress.sourceUnitId, type: 'control_break', targetId: unit.id, value: progress.progress })
  return true
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

function selectControlBeamTargets(source: SimUnit, config: ControlBeamConfig, units: SimUnit[]): SimUnit[] {
  const maxTargets = Math.max(1, config.maxTargets ?? 1)
  const range = Math.max(0, config.range ?? source.range)
  return units
    .filter(target => target.team !== source.team && isControlBeamTarget(source, target, range))
    .sort((a, b) => {
      const distance = getDistance(source.x, source.y, a.x, a.y) - getDistance(source.x, source.y, b.x, b.y)
      return distance !== 0 ? distance : a.id.localeCompare(b.id)
    })
    .slice(0, maxTargets)
}

function isControlBeamTarget(source: SimUnit, target: SimUnit, range: number): boolean {
  return !target.isDead && target.id !== source.id && canTargetUnit(source, target) &&
    getDistance(source.x, source.y, target.x, target.y) <= range
}

function breakStaleControlLinks(source: SimUnit, config: ControlBeamConfig, targets: SimUnit[], units: SimUnit[], actions: BattleAction[]): void {
  if (config.breakOnRange === false) return
  const activeTargetIds = new Set(targets.map(target => target.id))
  for (const unit of units) {
    if (unit.controlProgress?.sourceUnitId === source.id && !activeTargetIds.has(unit.id)) breakControlProgress(unit, actions)
  }
}

function applyControlProgress(source: SimUnit, target: SimUnit, config: ControlBeamConfig, targetCount: number, actions: BattleAction[]): void {
  if (target.controlProgress?.sourceUnitId !== source.id) {
    target.controlProgress = { sourceUnitId: source.id, sourceTeam: source.team, progress: 0, threshold: config.conversionThreshold, breakOnCleanse: config.breakOnCleanse !== false }
    actions.push({ unitId: source.id, type: 'control_link', targetId: target.id, value: 0 })
  }

  const multiplier = targetCount > 1 ? config.multiTargetProgressMultiplier ?? 1 : 1
  target.controlProgress.progress += Math.max(0, config.progressPerTick * multiplier)
  actions.push({ unitId: source.id, type: 'control_progress', targetId: target.id, value: Math.round(target.controlProgress.progress * 100) / 100 })
  if (target.controlProgress.progress < target.controlProgress.threshold) return

  target.team = source.team
  target.controlProgress = undefined
  target.attackTargetId = undefined
  target.aggroLockTicks = 0
  clearMeleeEngagementSlot(target)
  actions.push({ unitId: source.id, type: 'control_convert', targetId: target.id })
  if (config.healConvertedToMax && target.hp < target.maxHp) {
    const heal = target.maxHp - target.hp
    target.hp = target.maxHp
    actions.push({ unitId: source.id, type: 'heal', targetId: target.id, damage: heal })
  }
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
