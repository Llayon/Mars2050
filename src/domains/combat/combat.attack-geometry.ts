import { UNIT_TYPES } from './combat.config'
import type { SimUnit } from './combat.sim.types'
import type { UnitTypeKey } from './combat.types'
import { canTargetUnit } from './combat.targeting-rules'
import { getDistance, getSizeRadius } from './combat.utils'

export interface BarrageImpact { index: number; x: number; y: number; radius: number }
export interface ChainHit { target: SimUnit; jump: number; multiplier: number }

/**
 * Finds deterministic secondary targets for line-piercing attacks.
 * @param attacker Unit firing the attack
 * @param primary Primary target already hit by the attack
 * @param units All simulation units
 * @returns secondary targets sorted by line progress, then id
 */
export function getLinePierceTargets(attacker: SimUnit, primary: SimUnit, units: SimUnit[]): SimUnit[] {
  const config = UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.linePierce
  if (!config) return []

  const dx = primary.x - attacker.x
  const dy = primary.y - attacker.y
  const length = Math.hypot(dx, dy)
  if (length <= 0) return []

  const ux = dx / length
  const uy = dy / length
  const candidates = units
    .filter(unit => isLinePierceCandidate(attacker, primary, unit))
    .map(unit => ({ unit, progress: getLineProgress(attacker, unit, ux, uy) }))
    .filter(hit => hit.progress > 0 && hit.progress <= length)
    .filter(hit => getLineDistance(attacker, hit.unit, ux, uy, hit.progress) <= config.width + getSizeRadius(hit.unit.size))
    .sort((a, b) => a.progress - b.progress || a.unit.id.localeCompare(b.unit.id))

  return candidates.slice(0, config.maxTargets ?? candidates.length).map(hit => hit.unit)
}

/**
 * Reads line-pierce damage multiplier for a unit.
 * @param attacker Unit firing the attack
 * @returns multiplier, or undefined when the unit has no line-pierce config
 */
export function getLinePierceDamageMultiplier(attacker: SimUnit): number | undefined {
  return UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.linePierce?.damageMultiplier
}

/**
 * Finds deterministic secondary targets inside a cone centered on the primary target.
 * @param attacker Unit firing the attack
 * @param primary Primary target already hit by the attack
 * @param units All simulation units
 * @returns secondary targets sorted by distance, then id
 */
export function getConeTargets(attacker: SimUnit, primary: SimUnit, units: SimUnit[]): SimUnit[] {
  const config = UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.coneAttack
  if (!config) return []

  const centerAngle = Math.atan2(primary.y - attacker.y, primary.x - attacker.x)
  const maxAngle = degToRad(config.angleDeg) / 2
  const candidates = units
    .filter(unit => isAreaWeaponCandidate(attacker, primary, unit))
    .map(unit => ({ unit, distance: getDistance(attacker.x, attacker.y, unit.x, unit.y) }))
    .filter(hit => hit.distance <= attacker.range + getSizeRadius(hit.unit.size))
    .filter(hit => Math.abs(normalizeAngle(Math.atan2(hit.unit.y - attacker.y, hit.unit.x - attacker.x) - centerAngle)) <= maxAngle)
    .sort((a, b) => a.distance - b.distance || a.unit.id.localeCompare(b.unit.id))

  return candidates.slice(0, config.maxTargets ?? candidates.length).map(hit => hit.unit)
}

/**
 * Finds deterministic secondary targets for beam attacks.
 * @param attacker Unit firing the beam
 * @param primary Primary target already hit by the beam
 * @param units All simulation units
 * @returns secondary targets sorted by line progress, then id
 */
export function getBeamTargets(attacker: SimUnit, primary: SimUnit, units: SimUnit[]): SimUnit[] {
  const config = UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.beamAttack
  if (!config) return []

  const dx = primary.x - attacker.x
  const dy = primary.y - attacker.y
  const length = Math.hypot(dx, dy)
  if (length <= 0) return []

  const ux = dx / length
  const uy = dy / length
  const candidates = units
    .filter(unit => isAreaWeaponCandidate(attacker, primary, unit))
    .map(unit => ({ unit, progress: getLineProgress(attacker, unit, ux, uy) }))
    .filter(hit => hit.progress > 0 && hit.progress <= attacker.range)
    .filter(hit => getLineDistance(attacker, hit.unit, ux, uy, hit.progress) <= config.width + getSizeRadius(hit.unit.size))
    .sort((a, b) => a.progress - b.progress || a.unit.id.localeCompare(b.unit.id))

  return candidates.slice(0, config.maxTargets ?? candidates.length).map(hit => hit.unit)
}

export function getConeDamageMultiplier(attacker: SimUnit): number | undefined {
  return UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.coneAttack?.damageMultiplier
}

export function getBeamDamageMultiplier(attacker: SimUnit): number | undefined {
  return UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.beamAttack?.damageMultiplier
}

export function getBarrageImpacts(attacker: SimUnit, primary: SimUnit): BarrageImpact[] {
  const config = UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.barrageAttack
  if (!config) return []

  const impacts: BarrageImpact[] = []
  for (let index = 0; index < config.impacts; index++) {
    const offset = getBarrageOffset(index, config.spreadRadius)
    impacts.push({ index, x: primary.x + offset.x, y: primary.y + offset.y, radius: config.radius })
  }
  return impacts
}

export function getBarrageTargets(attacker: SimUnit, impact: BarrageImpact, units: SimUnit[]): SimUnit[] {
  const config = UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.barrageAttack
  if (!config) return []

  return units
    .filter(unit => !unit.isDead && unit.team !== attacker.team && canTargetUnit(attacker, unit))
    .map(unit => ({ unit, distance: getDistance(impact.x, impact.y, unit.x, unit.y) }))
    .filter(hit => hit.distance <= impact.radius + getSizeRadius(hit.unit.size))
    .sort((a, b) => a.distance - b.distance || a.unit.id.localeCompare(b.unit.id))
    .slice(0, config.maxTargetsPerImpact ?? Number.MAX_SAFE_INTEGER)
    .map(hit => hit.unit)
}

export function getBarrageDamageMultiplier(attacker: SimUnit): number | undefined {
  return UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.barrageAttack?.damageMultiplier
}

export function getChainTargets(attacker: SimUnit, primary: SimUnit, units: SimUnit[]): ChainHit[] {
  const config = UNIT_TYPES[attacker.type as UnitTypeKey]?.baseStats.chainAttack
  if (!config) return []

  const hits: ChainHit[] = []
  const visited = new Set([primary.id])
  let origin = primary

  for (let jump = 1; jump <= config.jumps; jump++) {
    const next = getNextChainTarget(attacker, origin, units, visited, config.radius)
    if (!next) break

    visited.add(next.id)
    hits.push({ target: next, jump, multiplier: config.damageMultiplier * Math.pow(config.falloff ?? 1, jump - 1) })
    origin = next
  }

  return hits
}

function isLinePierceCandidate(attacker: SimUnit, primary: SimUnit, candidate: SimUnit): boolean {
  return isAreaWeaponCandidate(attacker, primary, candidate)
}

function isAreaWeaponCandidate(attacker: SimUnit, primary: SimUnit, candidate: SimUnit): boolean {
  return !candidate.isDead &&
    candidate.id !== primary.id &&
    candidate.team !== attacker.team &&
    canTargetUnit(attacker, candidate)
}

function getLineProgress(attacker: SimUnit, target: SimUnit, ux: number, uy: number): number {
  return (target.x - attacker.x) * ux + (target.y - attacker.y) * uy
}

function getLineDistance(attacker: SimUnit, target: SimUnit, ux: number, uy: number, progress: number): number {
  const closestX = attacker.x + ux * progress
  const closestY = attacker.y + uy * progress
  return getDistance(target.x, target.y, closestX, closestY)
}

function getNextChainTarget(attacker: SimUnit, origin: SimUnit, units: SimUnit[], visited: Set<string>, radius: number): SimUnit | null {
  return units
    .filter(unit => !unit.isDead && !visited.has(unit.id) && unit.team !== attacker.team && canTargetUnit(attacker, unit))
    .map(unit => ({ unit, distance: getDistance(origin.x, origin.y, unit.x, unit.y) }))
    .filter(hit => hit.distance <= radius + getSizeRadius(hit.unit.size))
    .sort((a, b) => a.distance - b.distance || a.unit.id.localeCompare(b.unit.id))[0]?.unit ?? null
}

function normalizeAngle(angle: number): number {
  let result = angle
  while (result > Math.PI) result -= Math.PI * 2
  while (result < -Math.PI) result += Math.PI * 2
  return result
}

function degToRad(degrees: number): number {
  return degrees * Math.PI / 180
}

function getBarrageOffset(index: number, spreadRadius: number): { x: number; y: number } {
  if (index === 0 || spreadRadius <= 0) return { x: 0, y: 0 }
  const angle = (index - 1) * 2.399963229728653
  const ring = 0.55 + (index % 3) * 0.225
  return {
    x: Math.cos(angle) * spreadRadius * ring,
    y: Math.sin(angle) * spreadRadius * ring,
  }
}
