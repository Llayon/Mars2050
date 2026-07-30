import { getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

const ARC_QUANTA = 24
const MIN_SLOTS = 4
const MAX_SLOTS = 12

export interface EcsMeleeEngagementState {
  sectors: Map<EntityId, number>
}

export function createEcsMeleeEngagementState(): EcsMeleeEngagementState {
  return { sectors: new Map() }
}

export function hasEcsMeleeSlot(world: CombatWorld, unitId: EntityId, targetId: EntityId, state: EcsMeleeEngagementState): boolean {
  if (!isMelee(world, unitId)) return true
  return findSlot(world, unitId, targetId, state) !== null
}

export function reserveEcsMeleeSlot(world: CombatWorld, unitId: EntityId, targetId: EntityId, state: EcsMeleeEngagementState): boolean {
  if (!isMelee(world, unitId)) return true
  const slot = findSlot(world, unitId, targetId, state)
  if (slot === null) {
    clearAssigned(world, unitId)
    return false
  }
  const sectors = state.sectors.get(targetId) ?? 0
  state.sectors.set(targetId, reserveSector(sectors, slot, getSectorSpan(world, unitId, targetId)))
  const refs = world.stores.entityTargets.require(unitId)
  const targeting = world.stores.targeting.require(unitId)
  refs.meleeTarget = targetId
  refs.meleeWaitingTarget = undefined
  targeting.meleeSlotIndex = slot
  return true
}

export function clearEcsMeleeSlot(world: CombatWorld, unitId: EntityId): void {
  clearAssigned(world, unitId)
  world.stores.entityTargets.require(unitId).meleeWaitingTarget = undefined
}

export function setEcsMeleeWaitingTarget(world: CombatWorld, unitId: EntityId, targetId: EntityId): void {
  if (!isMelee(world, unitId)) return
  clearAssigned(world, unitId)
  world.stores.entityTargets.require(unitId).meleeWaitingTarget = targetId
}

function findSlot(world: CombatWorld, unitId: EntityId, targetId: EntityId, state: EcsMeleeEngagementState): number | null {
  const span = getSectorSpan(world, unitId, targetId)
  const refs = world.stores.entityTargets.require(unitId)
  const assigned = world.stores.targeting.require(unitId).meleeSlotIndex
  const sectors = state.sectors.get(targetId) ?? 0
  if (refs.meleeTarget === targetId && assigned !== undefined && assigned >= 0 &&
      assigned < ARC_QUANTA && isAvailable(sectors, assigned, span)) return assigned
  const preferred = getPreferredSlot(world, unitId, targetId, span)
  for (let offset = 0; offset < ARC_QUANTA; offset++) {
    const clockwise = (preferred + offset) % ARC_QUANTA
    if (isAvailable(sectors, clockwise, span)) return clockwise
    const counter = (preferred - offset + ARC_QUANTA) % ARC_QUANTA
    if (isAvailable(sectors, counter, span)) return counter
  }
  return null
}

function getPreferredSlot(world: CombatWorld, unitId: EntityId, targetId: EntityId, span: number): number {
  const unit = world.stores.transform.require(unitId)
  const target = world.stores.transform.require(targetId)
  const angle = Math.atan2(unit.y - target.y, unit.x - target.x)
  const normalized = angle < 0 ? angle + Math.PI * 2 : angle
  const center = Math.floor((normalized / (Math.PI * 2)) * ARC_QUANTA)
  return (center - Math.floor(span / 2) + ARC_QUANTA) % ARC_QUANTA
}

function getSectorSpan(world: CombatWorld, unitId: EntityId, targetId: EntityId): number {
  const unitSize = world.stores.transform.require(unitId).size
  const targetSize = world.stores.transform.require(targetId).size
  return SECTOR_SPANS[unitSize][targetSize]
}

function isAvailable(sectors: number, start: number, span: number): boolean {
  return (sectors & getSectorMask(start, span)) === 0
}

function reserveSector(sectors: number, start: number, span: number): number {
  return sectors | getSectorMask(start, span)
}

function clearAssigned(world: CombatWorld, unitId: EntityId): void {
  const refs = world.stores.entityTargets.require(unitId)
  const targeting = world.stores.targeting.require(unitId)
  refs.meleeTarget = undefined
  targeting.meleeSlotIndex = undefined
}

function isMelee(world: CombatWorld, entityId: EntityId): boolean {
  return world.stores.combat.require(entityId).range <= 60
}

function getSectorMask(start: number, span: number): number {
  const base = (1 << span) - 1
  const shifted = base << start
  return (shifted | (shifted >>> ARC_QUANTA)) & ((1 << ARC_QUANTA) - 1)
}

const SIZES = ['S', 'M', 'L', 'XL'] as const
const SECTOR_SPANS = Object.fromEntries(SIZES.map(unitSize => [
  unitSize,
  Object.fromEntries(SIZES.map(targetSize => {
    const unitRadius = getSizeRadius(unitSize)
    const targetRadius = getSizeRadius(targetSize)
    const rawSlots = Math.floor(
      (2 * Math.PI * (targetRadius + unitRadius)) / (unitRadius * 2),
    )
    const desired = Math.max(MIN_SLOTS, Math.min(MAX_SLOTS, rawSlots))
    const slotCount = Math.floor(ARC_QUANTA / Math.ceil(ARC_QUANTA / desired))
    return [targetSize, Math.max(1, Math.ceil(ARC_QUANTA / slotCount))]
  })),
])) as Record<typeof SIZES[number], Record<typeof SIZES[number], number>>
