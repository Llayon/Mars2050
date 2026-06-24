import type { SimUnit } from './combat.sim.types'
import { getSizeRadius } from './combat.utils'

const MAX_MELEE_SLOTS = 12
const MIN_MELEE_SLOTS = 4

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
  if (slot === null) return false

  if (!state.slotsByTarget[target.id]) state.slotsByTarget[target.id] = {}
  state.slotsByTarget[target.id][slot] = unit.id
  return true
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
  const preferred = getPreferredMeleeSlot(unit, target, slotCount)
  const slots = state.slotsByTarget[target.id] ?? {}

  for (let offset = 0; offset < slotCount; offset++) {
    const clockwise = (preferred + offset) % slotCount
    if (!slots[clockwise]) return clockwise

    const counterClockwise = (preferred - offset + slotCount) % slotCount
    if (!slots[counterClockwise]) return counterClockwise
  }

  return null
}

function getPreferredMeleeSlot(unit: SimUnit, target: SimUnit, slotCount: number): number {
  const angle = Math.atan2(unit.y - target.y, unit.x - target.x)
  const normalized = angle < 0 ? angle + Math.PI * 2 : angle
  return Math.floor((normalized / (Math.PI * 2)) * slotCount) % slotCount
}

function isMeleeUnit(unit: SimUnit): boolean {
  return unit.range <= 60
}
