import { chooseHackControlMode } from '../../combat.control-mode'
import type { HackControlMode } from '../../combat.primitives'
import type { TargetingProfileConfig } from '../../combat.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { canEcsTarget, getEcsMaxActionRange, getEcsTargetScore, getEcsTargetingProfile, getEntityDistance, isEcsTargetVisible } from '../targeting-evaluation'
import { isEcsPassiveSupport, selectEcsHealTarget, selectEcsPassiveSupportTarget } from '../support-targeting'
import { clearEcsMeleeSlot, hasEcsMeleeSlot, setEcsMeleeWaitingTarget, type EcsMeleeEngagementState } from './melee-engagement-system'

const AGGRO_LOCK_TICKS = 10
const AGGRO_LEASH_MULTIPLIER = 1.5
const MELEE_ACQUISITION_RADIUS = 240
const RANGED_ACQUISITION_BUFFER = 120
const HACK_CONTROL_LOCK_TICKS = 6

export function runTargetingSystem(world: CombatWorld, unitId: EntityId, melee: EcsMeleeEngagementState): EntityId | null {
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
  const candidates = getAcquisitionCandidates(world, unitId, mode)
  const controlled = selectHackTarget(world, unitId, candidates, melee, mode)
  if (controlled.handled) return controlled.target
  const locked = getLockedTarget(world, unitId, melee)
  if (locked !== null) {
    const targeting = world.stores.targeting.require(unitId)
    targeting.aggroLockTicks = Math.max(0, targeting.aggroLockTicks - 1)
    return locked
  }
  const enemies = candidates.filter(entityId => isReachableEnemy(world, unitId, entityId))
  if (enemies.length === 0) {
    clearTarget(world, unitId)
    return selectMovementFallback(world, unitId, melee)
  }
  const profile = getEcsTargetingProfile(world, unitId)
  let valid = enemies
  if (isMelee(world, unitId)) {
    valid = enemies.filter(targetId => hasEcsMeleeSlot(world, unitId, targetId, melee))
    if (valid.length === 0) {
      clearTarget(world, unitId, false)
      const waiting = selectAggroTarget(world, unitId, enemies, profile)
      if (waiting !== null) setEcsMeleeWaitingTarget(world, unitId, waiting)
      return waiting
    }
  }
  const target = selectAggroTarget(world, unitId, valid, profile)
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
): readonly EntityId[] {
  if (getEcsTargetingProfile(world, unitId).acquisition === 'global') return getUnits(world)
  const transform = world.stores.transform.require(unitId)
  const spatial = world.resources.require('entitySpatial')
  const radius = getAcquisitionRadius(world, unitId)
  if (mode === 'confuse') return spatial.query(world, transform.x, transform.y, radius, 'targeting')
  const ownTeam = world.stores.identity.require(unitId).team
  const targetTeam = mode === 'redirect'
    ? ownTeam
    : ownTeam === 'attacker' ? 'defender' : 'attacker'
  return spatial.queryTeam(world, transform.x, transform.y, radius, targetTeam, 'targeting')
}


function getLockedTarget(world: CombatWorld, unitId: EntityId, melee: EcsMeleeEngagementState): EntityId | null {
  const targeting = world.stores.targeting.require(unitId)
  const targetId = world.stores.entityTargets.require(unitId).attackTarget
  if (targetId === undefined || targeting.aggroLockTicks <= 0) return null
  if (isReachableEnemy(world, unitId, targetId) && isWithinLeash(world, unitId, targetId) && hasEcsMeleeSlot(world, unitId, targetId, melee)) return targetId
  clearTarget(world, unitId)
  return null
}

function selectMovementFallback(world: CombatWorld, unitId: EntityId, melee: EcsMeleeEngagementState): EntityId | null {
  const enemies = getUnits(world).filter(entityId => isReachableEnemy(world, unitId, entityId))
  if (enemies.length === 0) return null
  if (!isMelee(world, unitId)) return selectNearest(world, unitId, enemies)
  const valid = enemies.filter(targetId => hasEcsMeleeSlot(world, unitId, targetId, melee))
  if (valid.length > 0) return selectNearest(world, unitId, valid)
  const waiting = selectNearest(world, unitId, enemies)
  if (waiting !== null) setEcsMeleeWaitingTarget(world, unitId, waiting)
  return waiting
}

function selectAggroTarget(world: CombatWorld, unitId: EntityId, enemies: readonly EntityId[], profile: TargetingProfileConfig): EntityId | null {
  let target: EntityId | null = null
  let bestScore = -Infinity
  const nearestDistance = getNearestDistance(world, unitId, enemies)
  for (const enemyId of enemies) {
    const score = getEcsTargetScore(world, unitId, enemyId, profile, nearestDistance)
    if (target === null || score > bestScore || (score === bestScore && isBetterTie(world, unitId, enemyId, target))) {
      target = enemyId
      bestScore = score
    }
  }
  return target
}

function selectHackTarget(world: CombatWorld, unitId: EntityId, candidates: readonly EntityId[], melee: EcsMeleeEngagementState, mode: HackControlMode | null): { handled: boolean; target: EntityId | null } {
  if (mode === null) return { handled: false, target: null }
  const combat = world.stores.combat.require(unitId)
  const weapon = world.stores.weapon.require(unitId)
  if (mode === 'disable' || combat.attack <= 0 || weapon.attackType === 'heal' || weapon.attackType === 'spawn') {
    clearTarget(world, unitId)
    return { handled: true, target: null }
  }
  let targets = candidates.filter(targetId => isHackCandidate(world, unitId, targetId, mode))
  if (isMelee(world, unitId)) targets = targets.filter(targetId => hasEcsMeleeSlot(world, unitId, targetId, melee))
  const target = selectNearest(world, unitId, targets)
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

function getNearestDistance(world: CombatWorld, unitId: EntityId, targets: readonly EntityId[]): number {
  let nearest = Infinity
  for (const targetId of targets) nearest = Math.min(nearest, getEntityDistance(world, unitId, targetId))
  return nearest
}

function selectNearest(world: CombatWorld, unitId: EntityId, targets: readonly EntityId[]): EntityId | null {
  let target: EntityId | null = null
  for (const candidate of targets) if (target === null || isBetterTie(world, unitId, candidate, target)) target = candidate
  return target
}

function isBetterTie(world: CombatWorld, unitId: EntityId, candidate: EntityId, current: EntityId): boolean {
  const candidateDistance = getEntityDistance(world, unitId, candidate)
  const currentDistance = getEntityDistance(world, unitId, current)
  if (candidateDistance !== currentDistance) return candidateDistance < currentDistance
  const candidateHp = world.stores.vitality.require(candidate).hp
  const currentHp = world.stores.vitality.require(current).hp
  return candidateHp !== currentHp ? candidateHp < currentHp : getExternalId(world, candidate) < getExternalId(world, current)
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

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.entityMeta.require(entityId).externalId
}
