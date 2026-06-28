import type { SimUnit } from './combat.sim.types'
import { getSizeRadius } from './combat.utils'

const MAX_MELEE_SLOTS = 12
const MIN_MELEE_SLOTS = 4
const MELEE_SLOT_TOLERANCE = 12

export interface MeleeEngagementState {
  slotsByTarget: Record<string, Record<number, string>>
}

export function createMeleeEngagementState(): MeleeEngagementState {
  return { slotsByTarget: {} }
}

export function hasMeleeEngagementSlot(unit: SimUnit, target: SimUnit, state: MeleeEngagementState): boolean {
  if (!isMeleeUnit(unit)) return true
  return findMeleeSlot(unit, target, state) !== null
}

export function reserveMeleeEngagementSlot(unit: SimUnit, target: SimUnit, state: MeleeEngagementState): boolean {
  if (!isMeleeUnit(unit)) return true

  const slot = findMeleeSlot(unit, target, state)
  if (slot === null) {
    clearAssignedSlot(unit)
    return false
  }

  if (!state.slotsByTarget[target.id]) state.slotsByTarget[target.id] = {}
  state.slotsByTarget[target.id][slot] = unit.id
  unit.meleeSlotTargetId = target.id
  unit.meleeSlotIndex = slot
  unit.meleeWaitingTargetId = undefined
  return true
}

export function clearMeleeEngagementSlot(unit: SimUnit): void {
  clearAssignedSlot(unit)
  unit.meleeWaitingTargetId = undefined
}

export function setMeleeWaitingTarget(unit: SimUnit, target: SimUnit): void {
  if (!isMeleeUnit(unit)) return
  clearAssignedSlot(unit)
  unit.meleeWaitingTargetId = target.id
}

export function getMeleeEngagementPoint(unit: SimUnit, target: SimUnit): { x: number; y: number } {
  if (isMeleeUnit(unit) && unit.meleeWaitingTargetId === target.id) {
    return getMeleeWaitingPoint(unit, target)
  }

  if (!isMeleeUnit(unit) || unit.meleeSlotTargetId !== target.id || unit.meleeSlotIndex === undefined) {
    return { x: target.x, y: target.y }
  }

  const slotCount = getMeleeSlotCount(unit, target)
  if (unit.meleeSlotIndex < 0 || unit.meleeSlotIndex >= slotCount) return { x: target.x, y: target.y }

  const targetRadius = getSizeRadius(target.size)
  const unitRadius = getSizeRadius(unit.size)
  const approachRadius = targetRadius + unitRadius + Math.max(2, unit.range * 0.65)
  const angle = ((unit.meleeSlotIndex + 0.5) / slotCount) * Math.PI * 2
  return {
    x: target.x + Math.cos(angle) * approachRadius,
    y: target.y + Math.sin(angle) * approachRadius,
  }
}

export function isMeleeEngagementReady(unit: SimUnit, target: SimUnit): boolean {
  if (!isMeleeUnit(unit)) return true
  if (unit.meleeSlotTargetId !== target.id || unit.meleeSlotIndex === undefined) return false

  const point = getMeleeEngagementPoint(unit, target)
  const distance = Math.hypot(unit.x - point.x, unit.y - point.y)
  const tolerance = Math.max(MELEE_SLOT_TOLERANCE, unit.range * 0.75 + getSizeRadius(unit.size) * 0.5)
  return distance <= tolerance
}

export function isMeleeWaitingReady(unit: SimUnit, target: SimUnit): boolean {
  if (!isMeleeUnit(unit) || unit.meleeWaitingTargetId !== target.id) return false
  const point = getMeleeWaitingPoint(unit, target)
  return Math.hypot(unit.x - point.x, unit.y - point.y) <= MELEE_SLOT_TOLERANCE
}

export function getMeleeSlotCount(unit: SimUnit, target: SimUnit): number {
  const targetRadius = getSizeRadius(target.size)
  const unitRadius = getSizeRadius(unit.size)
  const engagementRadius = targetRadius + unitRadius
  const rawSlots = Math.floor((2 * Math.PI * engagementRadius) / (unitRadius * 2))
  return Math.max(MIN_MELEE_SLOTS, Math.min(MAX_MELEE_SLOTS, rawSlots))
}

function findMeleeSlot(unit: SimUnit, target: SimUnit, state: MeleeEngagementState): number | null {
  const slotCount = getMeleeSlotCount(unit, target)
  const assigned = getAssignedSlot(unit, target, state, slotCount)
  if (assigned !== null) return assigned

  const preferred = getPreferredMeleeSlot(unit, target, slotCount)
  const slots = state.slotsByTarget[target.id] ?? {}

  for (let offset = 0; offset < slotCount; offset++) {
    const clockwise = (preferred + offset) % slotCount
    if (isSlotAvailable(slots, clockwise, unit)) return clockwise

    const counterClockwise = (preferred - offset + slotCount) % slotCount
    if (isSlotAvailable(slots, counterClockwise, unit)) return counterClockwise
  }

  return null
}

function getAssignedSlot(unit: SimUnit, target: SimUnit, state: MeleeEngagementState, slotCount: number): number | null {
  if (unit.meleeSlotTargetId !== target.id || unit.meleeSlotIndex === undefined) return null
  if (unit.meleeSlotIndex < 0 || unit.meleeSlotIndex >= slotCount) return null

  const slots = state.slotsByTarget[target.id] ?? {}
  return isSlotAvailable(slots, unit.meleeSlotIndex, unit) ? unit.meleeSlotIndex : null
}

function isSlotAvailable(slots: Record<number, string>, slot: number, unit: SimUnit): boolean {
  return !slots[slot] || slots[slot] === unit.id
}

function clearAssignedSlot(unit: SimUnit): void {
  unit.meleeSlotTargetId = undefined
  unit.meleeSlotIndex = undefined
}

function getMeleeWaitingPoint(unit: SimUnit, target: SimUnit): { x: number; y: number } {
  const targetRadius = getSizeRadius(target.size)
  const unitRadius = getSizeRadius(unit.size)
  const radius = targetRadius + unitRadius + Math.max(36, unit.range * 1.35)
  const angle = getDeterministicWaitingAngle(unit.id, target.id)
  return {
    x: target.x + Math.cos(angle) * radius,
    y: target.y + Math.sin(angle) * radius,
  }
}

function getPreferredMeleeSlot(unit: SimUnit, target: SimUnit, slotCount: number): number {
  const angle = Math.atan2(unit.y - target.y, unit.x - target.x)
  const normalized = angle < 0 ? angle + Math.PI * 2 : angle
  return Math.floor((normalized / (Math.PI * 2)) * slotCount) % slotCount
}

function isMeleeUnit(unit: SimUnit): boolean {
  return unit.range <= 60
}

function getDeterministicWaitingAngle(unitId: string, targetId: string): number {
  let hash = 2166136261
  const value = `${unitId}:${targetId}:wait`
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) / 4294967295) * Math.PI * 2
}
