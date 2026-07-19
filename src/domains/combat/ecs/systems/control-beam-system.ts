import type { BattleAction } from '../../combat.actions'
import type { ControlBeamConfig } from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import { canEcsTarget } from '../targeting-evaluation'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsHealing } from './healing-system'

export function getEcsControlBeamEntities(world: CombatWorld): EntityId[] {
  return world.query([
    'identity',
    'transform',
    'vitality',
    'combat',
    'targeting',
  ]).filter(entityId =>
    Boolean(world.stores.targeting.require(entityId).controlBeam),
  )
}

export function runEcsControlBeamSystem(
  world: CombatWorld,
  actions: BattleAction[],
  entityIds = getEcsControlBeamEntities(world),
): void {
  const sources = [...entityIds].sort((left, right) =>
    getExternalId(world, left).localeCompare(getExternalId(world, right)),
  )
  for (const sourceId of sources) {
    if (world.stores.vitality.require(sourceId).isDead) continue
    const config = world.stores.targeting.require(sourceId).controlBeam
    if (!config) continue
    const targets = selectTargets(world, sourceId, config)
    breakStaleLinks(world, sourceId, config, targets, actions)
    for (const targetId of targets) {
      applyControlProgress(
        world,
        sourceId,
        targetId,
        config,
        targets.length,
        actions,
      )
    }
  }
  breakOrphanedLinks(world, actions)
}

function selectTargets(
  world: CombatWorld,
  sourceId: EntityId,
  config: ControlBeamConfig,
): EntityId[] {
  const sourceIdentity = world.stores.identity.require(sourceId)
  const source = world.stores.transform.require(sourceId)
  const range = Math.max(
    0,
    config.range ?? world.stores.combat.require(sourceId).range,
  )
  return world.resources.require('entitySpatial')
    .query(world, source.x, source.y, range)
    .filter(targetId =>
      targetId !== sourceId &&
      world.stores.identity.require(targetId).team !== sourceIdentity.team &&
      canEcsTarget(world, sourceId, targetId),
    )
    .sort((left, right) => {
      const leftDistance = getEntityDistance(world, sourceId, left)
      const rightDistance = getEntityDistance(world, sourceId, right)
      return leftDistance !== rightDistance
        ? leftDistance - rightDistance
        : getExternalId(world, left).localeCompare(getExternalId(world, right))
    })
    .slice(0, Math.max(1, config.maxTargets ?? 1))
}

function breakStaleLinks(
  world: CombatWorld,
  sourceId: EntityId,
  config: ControlBeamConfig,
  targets: EntityId[],
  actions: BattleAction[],
): void {
  if (config.breakOnRange === false) return
  const sourceExternalId = getExternalId(world, sourceId)
  const activeTargets = new Set(targets)
  for (const entityId of world.query(['identity', 'targeting'], true)) {
    const progress = world.stores.targeting.require(entityId).controlProgress
    if (progress?.sourceUnitId === sourceExternalId &&
        !activeTargets.has(entityId)) breakControlProgress(world, entityId, actions)
  }
}

function applyControlProgress(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  config: ControlBeamConfig,
  targetCount: number,
  actions: BattleAction[],
): void {
  const source = world.stores.identity.require(sourceId)
  const target = world.stores.identity.require(targetId)
  const targeting = world.stores.targeting.require(targetId)
  if (targeting.controlProgress?.sourceUnitId !== source.id) {
    targeting.controlProgress = {
      sourceUnitId: source.id,
      sourceTeam: source.team,
      progress: 0,
      threshold: config.conversionThreshold,
      breakOnCleanse: config.breakOnCleanse !== false,
    }
    actions.push({
      unitId: source.id,
      type: 'control_link',
      targetId: target.id,
      value: 0,
    })
  }
  const multiplier = targetCount > 1
    ? config.multiTargetProgressMultiplier ?? 1
    : 1
  targeting.controlProgress.progress += Math.max(
    0,
    config.progressPerTick * multiplier,
  )
  actions.push({
    unitId: source.id,
    type: 'control_progress',
    targetId: target.id,
    value: Math.round(targeting.controlProgress.progress * 100) / 100,
  })
  if (targeting.controlProgress.progress <
      targeting.controlProgress.threshold) return

  target.team = source.team
  targeting.controlProgress = undefined
  clearTargeting(world, targetId)
  actions.push({
    unitId: source.id,
    type: 'control_convert',
    targetId: target.id,
  })
  const vitality = world.stores.vitality.require(targetId)
  if (config.healConvertedToMax && vitality.hp < vitality.maxHp) {
    applyEcsHealing(
      world,
      sourceId,
      targetId,
      vitality.maxHp - vitality.hp,
      actions,
    )
  }
}

function breakOrphanedLinks(
  world: CombatWorld,
  actions: BattleAction[],
): void {
  for (const entityId of world.query(['identity', 'vitality', 'targeting'], true)) {
    const vitality = world.stores.vitality.require(entityId)
    const progress = world.stores.targeting.require(entityId).controlProgress
    if (!progress) continue
    const sourceId = world.getEntityId(progress.sourceUnitId)
    if (sourceId === undefined ||
        world.stores.vitality.require(sourceId).isDead ||
        vitality.isDead) breakControlProgress(world, entityId, actions)
  }
}

function breakControlProgress(
  world: CombatWorld,
  entityId: EntityId,
  actions: BattleAction[],
): void {
  const targeting = world.stores.targeting.require(entityId)
  const progress = targeting.controlProgress
  if (!progress) return
  targeting.controlProgress = undefined
  actions.push({
    unitId: progress.sourceUnitId,
    type: 'control_break',
    targetId: getExternalId(world, entityId),
    value: progress.progress,
  })
}

function clearTargeting(world: CombatWorld, entityId: EntityId): void {
  const targeting = world.stores.targeting.require(entityId)
  targeting.attackTargetId = undefined
  targeting.aggroLockTicks = 0
  targeting.meleeSlotTargetId = undefined
  targeting.meleeSlotIndex = undefined
  targeting.meleeWaitingTargetId = undefined
  const refs = world.stores.entityTargets.require(entityId)
  refs.attackTarget = undefined
  refs.meleeTarget = undefined
  refs.meleeWaitingTarget = undefined
}

function getEntityDistance(
  world: CombatWorld,
  leftId: EntityId,
  rightId: EntityId,
): number {
  const left = world.stores.transform.require(leftId)
  const right = world.stores.transform.require(rightId)
  return getDistance(left.x, left.y, right.x, right.y)
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.identity.require(entityId).id
}
