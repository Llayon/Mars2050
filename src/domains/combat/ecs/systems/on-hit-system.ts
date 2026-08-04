import type { BattleAction } from '../../combat.actions'
import type { TargetMarkConfig } from '../../combat.primitives'
import type { CombatWorld } from '../combat-world'
import { getDesignationIndex } from '../designation-index'
import type { EntityId } from '../entity'
import {
  canEcsTarget,
  getEntityDistance,
  isEcsTargetVisible,
} from '../targeting-evaluation'
import { applyEcsStatus } from './status-application-system'

export interface EcsOnHitOptions {
  propagateSquadMark?: boolean
}

export function applyEcsOnHitEffects(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  options: EcsOnHitOptions = {},
): void {
  if (world.stores.vitality.require(targetId).isDead) return
  const attacker = world.stores.identity.require(attackerId)
  const weapon = world.stores.weapon.require(attackerId)
  if (weapon.appliesEmp) {
    applyEcsStatus(world, targetId, {
      type: 'emp',
      duration: 30,
      sourceUnitId: attacker.id,
    }, actions)
  }
  for (const status of weapon.statusOnHit ?? []) {
    applyEcsStatus(world, targetId, { ...status, sourceUnitId: attacker.id }, actions)
  }
  if (weapon.markOnHit) {
    applyEcsTargetMark(
      world,
      attackerId,
      targetId,
      weapon.markOnHit,
      actions,
      options.propagateSquadMark !== false,
    )
  }
}

function applyEcsTargetMark(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  mark: TargetMarkConfig,
  actions: BattleAction[],
  propagateSquad: boolean,
): void {
  const attacker = world.stores.identity.require(attackerId)
  const target = world.stores.identity.require(targetId)
  const squadId = target.squadId ?? target.id
  const sourceTargeting = world.stores.targeting.require(attackerId)
  const previousSquadId = sourceTargeting.designatedSquadId
  const markEvent = previousSquadId === squadId ? 'refresh' : 'new_squad'
  if (markEvent === 'new_squad' && mark.retargetPolicy === 'new_squad_only') {
    clearPreviousDesignation(world, attackerId, actions)
  }
  sourceTargeting.designatedSquadId = squadId
  const markedTargetIds = applyMarkToSquad(
    world, attackerId, targetId, mark, propagateSquad,
  )
  getDesignationIndex(world).set(
    attackerId,
    attacker.team,
    squadId,
    markedTargetIds,
    mark.focusRadius ?? 0,
  )
  const shouldRetarget = mark.retargetPolicy === 'always' ||
    mark.retargetPolicy === 'new_squad_only' && markEvent === 'new_squad'
  const retargetCount = shouldRetarget
    ? requestAlliedRetarget(world, attackerId, markedTargetIds, mark)
    : 0
  actions.push({
    unitId: attacker.id,
    type: 'target_mark',
    targetId: target.id,
    value: mark.damageMultiplier ?? mark.executeThreshold ?? mark.focusPriority,
    markEvent,
    markSquadId: squadId,
    markDuration: mark.duration,
    retargetCount,
  })
}

function applyMarkToSquad(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  mark: TargetMarkConfig,
  propagateSquad: boolean,
): EntityId[] {
  const attacker = world.stores.identity.require(attackerId)
  const target = world.stores.identity.require(targetId)
  const targetIds = [targetId]
  setTargetMark(world, targetId, attackerId, attacker.id, mark)
  if (!propagateSquad || !mark.squadWide || !target.squadId) return targetIds
  for (const squadmateId of world.query(['identity', 'statusControl'])) {
    if (squadmateId === targetId) continue
    const squadmate = world.stores.identity.require(squadmateId)
    if (squadmate.team !== target.team || squadmate.squadId !== target.squadId) continue
    setTargetMark(world, squadmateId, attackerId, attacker.id, mark)
    targetIds.push(squadmateId)
  }
  return targetIds
}

function setTargetMark(
  world: CombatWorld,
  targetId: EntityId,
  attackerId: EntityId,
  attackerExternalId: string,
  mark: TargetMarkConfig,
): void {
  world.stores.statusControl.require(targetId).targetMark = {
    ...mark,
    sourceUnitId: attackerExternalId,
  }
  world.stores.entitySources.require(targetId).targetMarkSource = attackerId
}

function clearPreviousDesignation(
  world: CombatWorld,
  attackerId: EntityId,
  actions: BattleAction[],
): void {
  const attackerExternalId = world.stores.identity.require(attackerId).id
  for (const targetId of world.query(['identity', 'statusControl'], true)) {
    const status = world.stores.statusControl.require(targetId)
    if (world.stores.entitySources.require(targetId).targetMarkSource !== attackerId) continue
    status.targetMark = undefined
    world.stores.entitySources.require(targetId).targetMarkSource = undefined
    actions.push({
      unitId: attackerExternalId,
      type: 'target_mark_expire',
      targetId: world.stores.identity.require(targetId).id,
    })
  }
  getDesignationIndex(world).clear(attackerId)
}

function requestAlliedRetarget(
  world: CombatWorld,
  attackerId: EntityId,
  targetIds: EntityId[],
  mark: TargetMarkConfig,
): number {
  if (!mark.sharedDamage || (mark.focusPriority ?? 0) <= 0) return 0
  const focusRadius = Math.max(0, mark.focusRadius ?? Number.POSITIVE_INFINITY)
  const lockTicks = Math.max(0, Math.floor(mark.retargetLockTicks ?? 0))
  const attacker = world.stores.identity.require(attackerId)
  const targetSquadId = world.stores.identity.require(targetIds[0]).squadId
  let retargetCount = 0
  for (const allyId of world.query(['identity', 'targeting', 'entityTargets'])) {
    if (allyId === attackerId) continue
    const ally = world.stores.identity.require(allyId)
    if (ally.team !== attacker.team) continue
    const combat = world.stores.combat.require(allyId)
    const weapon = world.stores.weapon.require(allyId)
    if (combat.attack <= 0 || weapon.attackType === 'heal' ||
        weapon.attackType === 'spawn') continue
    const currentTargetId = world.stores.entityTargets.require(allyId).attackTarget
    if (currentTargetId !== undefined &&
        world.stores.identity.require(currentTargetId).squadId === targetSquadId) continue
    const eligible = targetIds.some(candidateId =>
      !world.stores.vitality.require(candidateId).isDead &&
      canEcsTarget(world, allyId, candidateId) &&
      isEcsTargetVisible(world, candidateId) &&
      getEntityDistance(world, allyId, candidateId) <= focusRadius)
    if (!eligible) continue
    const targeting = world.stores.targeting.require(allyId)
    targeting.aggroLockTicks = Math.min(targeting.aggroLockTicks, lockTicks)
    retargetCount++
  }
  return retargetCount
}
