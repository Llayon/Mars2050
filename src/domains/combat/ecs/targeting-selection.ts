import type { TargetingProfileConfig } from '../combat.types'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import {
  getEcsTargetScore,
  getEntityDistance,
  isEcsTargetVisible,
} from './targeting-evaluation'
import type { TargetingScratch } from './targeting-scratch'

export function selectEcsAggroTarget(
  world: CombatWorld,
  unitId: EntityId,
  candidates: TargetingScratch,
  profile: TargetingProfileConfig,
  predicate?: (targetId: EntityId) => boolean,
): EntityId | null {
  let nearestDistance = Infinity
  for (let index = 0; index < candidates.length; index++) {
    const entityId = candidates.entityIds[index]
    const eligible = predicate === undefined || predicate(entityId)
    candidates.eligible[index] = eligible ? 1 : 0
    if (!eligible) continue
    const distance = getCandidateDistance(world, unitId, candidates, index)
    candidates.distances[index] = distance
    nearestDistance = Math.min(nearestDistance, distance)
  }
  let target: EntityId | null = null
  let targetDistance = Infinity
  let bestScore = -Infinity
  const currentTarget = world.stores.entityTargets.require(unitId).attackTarget
  const targetPriorityProfile = world.stores.targeting.require(unitId)
    .targetPriorityProfile
  for (let index = 0; index < candidates.length; index++) {
    if (candidates.eligible[index] === 0) continue
    const candidateId = candidates.entityIds[index]
    const candidateDistance = candidates.distances[index]
    const score = getEcsTargetScore(
      world,
      unitId,
      candidateId,
      profile,
      nearestDistance,
      candidateDistance,
      currentTarget,
      targetPriorityProfile,
    )
    if (target === null || score > bestScore ||
        (score === bestScore && isBetterTargetCandidate(
          world, candidateId, candidateDistance, target, targetDistance,
        ))) {
      target = candidateId
      targetDistance = candidateDistance
      bestScore = score
    }
  }
  return target
}

export function selectEcsNearestTarget(
  world: CombatWorld,
  unitId: EntityId,
  candidates: TargetingScratch,
  predicate?: (targetId: EntityId) => boolean,
): EntityId | null {
  let target: EntityId | null = null
  let targetDistance = Infinity
  for (let index = 0; index < candidates.length; index++) {
    const entityId = candidates.entityIds[index]
    if (predicate && !predicate(entityId)) continue
    const distance = getCandidateDistance(world, unitId, candidates, index)
    if (target === null || isBetterTargetCandidate(
      world, entityId, distance, target, targetDistance,
    )) {
      target = entityId
      targetDistance = distance
    }
  }
  return target
}

export function compactEcsReachableEnemies(
  world: CombatWorld,
  unitId: EntityId,
  candidates: TargetingScratch,
): void {
  const sourceTeam = world.stores.identity.require(unitId).team
  const canTargetAir = world.stores.combat.require(unitId).canTargetAir
  let writeIndex = 0
  for (let readIndex = 0; readIndex < candidates.length; readIndex++) {
    const entityId = candidates.entityIds[readIndex]
    if (entityId === unitId ||
        (!candidates.liveTeamFiltered &&
          (world.stores.vitality.require(entityId).isDead ||
            world.stores.identity.require(entityId).team === sourceTeam)) ||
        (world.stores.transform.require(entityId).isFlying && !canTargetAir) ||
        !isEcsTargetVisible(world, entityId)) continue
    candidates.entityIds[writeIndex] = entityId
    candidates.distances[writeIndex] = candidates.distances[readIndex]
    writeIndex++
  }
  candidates.length = writeIndex
}

function isBetterTargetCandidate(
  world: CombatWorld,
  candidateId: EntityId,
  candidateDistance: number,
  currentId: EntityId,
  currentDistance: number,
): boolean {
  if (candidateDistance !== currentDistance) return candidateDistance < currentDistance
  const candidateHp = world.stores.vitality.require(candidateId).hp
  const currentHp = world.stores.vitality.require(currentId).hp
  return candidateHp !== currentHp
    ? candidateHp < currentHp
    : getExternalId(world, candidateId) < getExternalId(world, currentId)
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.entityMeta.require(entityId).externalId
}

function getCandidateDistance(
  world: CombatWorld,
  unitId: EntityId,
  candidates: TargetingScratch,
  index: number,
): number {
  const known = candidates.distances[index]
  return Number.isNaN(known)
    ? getEntityDistance(world, unitId, candidates.entityIds[index])
    : known
}
