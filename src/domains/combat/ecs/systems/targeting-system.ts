import { chooseHackControlMode } from '../../combat.control-mode'
import type { HackControlMode } from '../../combat.primitives'
import type { TargetingProfileConfig } from '../../combat.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { TargetingRuntime } from '../targeting-runtime'
import {
  compactEcsReachableEnemies,
  selectEcsAggroTarget,
  selectEcsNearestTarget,
} from '../targeting-selection'
import type { TargetingScratch } from '../targeting-scratch'
import { canEcsTarget, getEcsMaxActionRange, getEcsTargetingProfile, getEntityDistance, isEcsTargetVisible } from '../targeting-evaluation'
import { isEcsPassiveSupport, selectEcsHealTarget, selectEcsPassiveSupportTarget } from '../support-targeting'
import { clearEcsMeleeSlot, hasEcsMeleeSlot, setEcsMeleeWaitingTarget, type EcsMeleeEngagementState } from './melee-engagement-system'

const AGGRO_LOCK_TICKS = 10
const AGGRO_LEASH_MULTIPLIER = 1.5
const MELEE_ACQUISITION_RADIUS = 240
const RANGED_ACQUISITION_BUFFER = 120
const HACK_CONTROL_LOCK_TICKS = 6

export function runTargetingSystem(
  world: CombatWorld,
  unitId: EntityId,
  melee: EcsMeleeEngagementState,
  targeting = getTargetingRuntime(world),
): EntityId | null {
  const startedAt = targeting.startSelection()
  try {
    return resolveTarget(world, unitId, melee, targeting)
  } finally {
    targeting.finishSelection(startedAt)
  }
}

function resolveTarget(
  world: CombatWorld,
  unitId: EntityId,
  melee: EcsMeleeEngagementState,
  targeting: TargetingRuntime,
): EntityId | null {
  const mode = getHackMode(world, unitId)
  const weapon = world.stores.weapon.require(unitId)
  const combat = world.stores.combat.require(unitId)
  if (mode === null) {
    if (weapon.attackType === 'heal') return selectEcsHealTarget(world, unitId)
    if (isEcsPassiveSupport(world, unitId)) return selectEcsPassiveSupportTarget(world, unitId)
  } else if (mode === 'disable' || combat.attack <= 0 ||
      weapon.attackType === 'heal' || weapon.attackType === 'spawn') {
    clearTarget(world, unitId)
    return null
  }
  if (mode === null) {
    const locked = getLockedTarget(world, unitId, melee)
    if (locked !== null) {
      const targeting = world.stores.targeting.require(unitId)
      targeting.aggroLockTicks = Math.max(0, targeting.aggroLockTicks - 1)
      return locked
    }
  }
  const profile = getEcsTargetingProfile(world, unitId)
  const candidates = getAcquisitionCandidates(
    world, unitId, mode, targeting, profile,
  )
  const controlled = selectHackTarget(world, unitId, candidates, melee, mode)
  if (controlled.handled) return controlled.target
  compactEcsReachableEnemies(world, unitId, candidates)
  if (candidates.length === 0) {
    clearTarget(world, unitId)
    return selectMovementFallback(world, unitId, melee, targeting)
  }
  if (isMelee(world, unitId)) {
    const target = selectEcsAggroTarget(
      world, unitId, candidates, profile,
      targetId => hasEcsMeleeSlot(world, unitId, targetId, melee),
    )
    if (target === null) {
      clearTarget(world, unitId, false)
      const waiting = selectEcsAggroTarget(world, unitId, candidates, profile)
      if (waiting !== null) setEcsMeleeWaitingTarget(world, unitId, waiting)
      return waiting
    }
    setTarget(world, unitId, target, profile.targetingCooldownTicks ?? AGGRO_LOCK_TICKS)
    return target
  }
  const target = selectEcsAggroTarget(world, unitId, candidates, profile)
  if (target === null) {
    clearTarget(world, unitId)
    return null
  }
  setTarget(world, unitId, target, profile.targetingCooldownTicks ?? AGGRO_LOCK_TICKS)
  return target
}

function getAcquisitionCandidates(
  world: CombatWorld,
  unitId: EntityId,
  mode: HackControlMode | null,
  targeting: TargetingRuntime,
  profile: TargetingProfileConfig,
): TargetingScratch {
  if (profile.acquisition === 'global') {
    targeting.scratch.fill(getUnits(world))
    return targeting.scratch
  }
  const transform = world.stores.transform.require(unitId)
  const radius = getAcquisitionRadius(world, unitId)
  if (mode === 'confuse') {
    return targeting.collect(world, transform.x, transform.y, radius, 'all')
  }
  const ownTeam = world.stores.identity.require(unitId).team
  const targetTeam = mode === 'redirect'
    ? ownTeam
    : ownTeam === 'attacker' ? 'defender' : 'attacker'
  return targeting.collect(world, transform.x, transform.y, radius, targetTeam)
}


function getLockedTarget(world: CombatWorld, unitId: EntityId, melee: EcsMeleeEngagementState): EntityId | null {
  const targeting = world.stores.targeting.require(unitId)
  const targetId = world.stores.entityTargets.require(unitId).attackTarget
  if (targetId === undefined || targeting.aggroLockTicks <= 0) return null
  if (isReachableEnemy(world, unitId, targetId) && isWithinLeash(world, unitId, targetId) && hasEcsMeleeSlot(world, unitId, targetId, melee)) return targetId
  clearTarget(world, unitId)
  return null
}

function selectMovementFallback(
  world: CombatWorld,
  unitId: EntityId,
  melee: EcsMeleeEngagementState,
  targeting: TargetingRuntime,
): EntityId | null {
  const candidates = targeting.scratch
  candidates.fill(getUnits(world))
  compactEcsReachableEnemies(world, unitId, candidates)
  if (candidates.length === 0) return null
  if (!isMelee(world, unitId)) return selectEcsNearestTarget(world, unitId, candidates)
  const target = selectEcsNearestTarget(
    world, unitId, candidates,
    targetId => hasEcsMeleeSlot(world, unitId, targetId, melee),
  )
  if (target !== null) return target
  const waiting = selectEcsNearestTarget(world, unitId, candidates)
  if (waiting !== null) setEcsMeleeWaitingTarget(world, unitId, waiting)
  return waiting
}

function selectHackTarget(world: CombatWorld, unitId: EntityId, candidates: TargetingScratch, melee: EcsMeleeEngagementState, mode: HackControlMode | null): { handled: boolean; target: EntityId | null } {
  if (mode === null) return { handled: false, target: null }
  const combat = world.stores.combat.require(unitId)
  const weapon = world.stores.weapon.require(unitId)
  if (mode === 'disable' || combat.attack <= 0 || weapon.attackType === 'heal' || weapon.attackType === 'spawn') {
    clearTarget(world, unitId)
    return { handled: true, target: null }
  }
  const meleeUnit = isMelee(world, unitId)
  const target = selectEcsNearestTarget(world, unitId, candidates, targetId =>
    isHackCandidate(world, unitId, targetId, mode) &&
    (!meleeUnit || hasEcsMeleeSlot(world, unitId, targetId, melee)),
  )
  if (target === null) clearTarget(world, unitId)
  else setTarget(world, unitId, target, HACK_CONTROL_LOCK_TICKS)
  return { handled: true, target }
}

function getHackMode(world: CombatWorld, unitId: EntityId): HackControlMode | null {
  let mode: HackControlMode | undefined
  for (const effect of world.stores.statusControl.require(unitId).statusEffects) {
    if (effect.type === 'hacked' && effect.duration > 0) mode = chooseHackControlMode(mode, effect.controlMode ?? 'disable')
  }
  return mode ?? null
}

function isHackCandidate(world: CombatWorld, unitId: EntityId, targetId: EntityId, mode: HackControlMode): boolean {
  if (world.stores.vitality.require(targetId).isDead || targetId === unitId || !canEcsTarget(world, unitId, targetId)) return false
  const unitTeam = world.stores.identity.require(unitId).team
  const targetTeam = world.stores.identity.require(targetId).team
  if (targetTeam !== unitTeam && !isEcsTargetVisible(world, targetId)) return false
  return mode !== 'redirect' || targetTeam === unitTeam
}

function isReachableEnemy(world: CombatWorld, unitId: EntityId, targetId: EntityId): boolean {
  return !world.stores.vitality.require(targetId).isDead && unitId !== targetId && world.stores.identity.require(unitId).team !== world.stores.identity.require(targetId).team && canEcsTarget(world, unitId, targetId) && isEcsTargetVisible(world, targetId)
}

function isWithinLeash(world: CombatWorld, unitId: EntityId, targetId: EntityId): boolean {
  if (getEcsTargetingProfile(world, unitId).acquisition === 'global') return true
  return getEntityDistance(world, unitId, targetId) <= getAcquisitionRadius(world, unitId) * AGGRO_LEASH_MULTIPLIER
}

function getAcquisitionRadius(world: CombatWorld, unitId: EntityId): number {
  const range = getEcsMaxActionRange(world, unitId)
  return range <= 60 ? MELEE_ACQUISITION_RADIUS : Math.max(MELEE_ACQUISITION_RADIUS, range + RANGED_ACQUISITION_BUFFER)
}

function setTarget(world: CombatWorld, unitId: EntityId, targetId: EntityId, lockTicks: number): void {
  world.stores.entityTargets.require(unitId).attackTarget = targetId
  world.stores.targeting.require(unitId).aggroLockTicks = lockTicks
}

function clearTarget(world: CombatWorld, unitId: EntityId, clearMelee = true): void {
  world.stores.entityTargets.require(unitId).attackTarget = undefined
  const targeting = world.stores.targeting.require(unitId)
  targeting.aggroLockTicks = 0
  if (clearMelee) clearEcsMeleeSlot(world, unitId)
}

function isMelee(world: CombatWorld, unitId: EntityId): boolean {
  return getEcsMaxActionRange(world, unitId) <= 60
}

function getUnits(world: CombatWorld): readonly EntityId[] {
  return world.query(['identity', 'transform', 'vitality', 'combat', 'weapon', 'targeting', 'entityTargets'])
}

function getTargetingRuntime(world: CombatWorld): TargetingRuntime {
  const current = world.resources.get('targetingRuntime')
  if (current) return current
  const runtime = new TargetingRuntime(false)
  world.resources.set('targetingRuntime', runtime)
  return runtime
}
