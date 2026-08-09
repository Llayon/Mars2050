import { getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getMeleeSectorSpan, getPreferredMeleeSlot, MELEE_ARC_QUANTA } from '../melee-arc'

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
      assigned < MELEE_ARC_QUANTA && isAvailable(sectors, assigned, span)) return assigned
  const preferred = getPreferredSlot(world, unitId, targetId, span)
  for (let offset = 0; offset < MELEE_ARC_QUANTA; offset++) {
    const clockwise = (preferred + offset) % MELEE_ARC_QUANTA
    if (isAvailable(sectors, clockwise, span)) return clockwise
    const counter = (preferred - offset + MELEE_ARC_QUANTA) % MELEE_ARC_QUANTA
    if (isAvailable(sectors, counter, span)) return counter
  }
  return null
}

function getPreferredSlot(world: CombatWorld, unitId: EntityId, targetId: EntityId, span: number): number {
  const unit = world.stores.transform.require(unitId)
  const target = world.stores.transform.require(targetId)
  const angle = Math.atan2(unit.y - target.y, unit.x - target.x)
  return getPreferredMeleeSlot(angle, span)
}

function getSectorSpan(world: CombatWorld, unitId: EntityId, targetId: EntityId): number {
  const unitSize = world.stores.transform.require(unitId).size
  const targetSize = world.stores.transform.require(targetId).size
  return getMeleeSectorSpan(getSizeRadius(unitSize), getSizeRadius(targetSize))
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
  return (shifted | (shifted >>> MELEE_ARC_QUANTA)) & ((1 << MELEE_ARC_QUANTA) - 1)
}
