import type { BattleAction } from '../../combat.actions'
import type { DeathCause } from '../../combat.death.types'
import type { SimHazard } from '../../combat.sim.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsOnKillEffects } from './on-kill-system'
import { processEcsKillTriggers } from './post-hit-trigger-system'
import { processEcsDeathTriggers } from './death-trigger-system'
import { applyEcsHealing } from './healing-system'

export function resolveEcsDeath(
  world: CombatWorld,
  targetId: EntityId,
  sourceId: EntityId | undefined,
  actions: BattleAction[],
  cause: DeathCause = 'weapon',
): boolean {
  const target = world.stores.vitality.require(targetId)
  if (target.isDead) return false
  if (cause === 'expiration') {
    world.setEntityDead(targetId, true)
    actions.push({
      unitId: world.stores.identity.require(targetId).id,
      type: 'die',
      sourceUnitId: sourceId === undefined
        ? undefined
        : world.stores.identity.require(sourceId).id,
      cause,
    })
    return true
  }
  if (target.hp > 0) return false
  if (target.resurrectOnce) {
    target.resurrectOnce = false
    applyEcsHealing(world, targetId, targetId, target.maxHp, actions, {
      bypassStatusBlock: true,
    })
    return false
  }
  startDeathReassembly(world, targetId, actions)
  world.setEntityDead(targetId, true)
  const actorId = sourceId ?? targetId
  actions.push({
    unitId: world.stores.identity.require(targetId).id,
    type: 'die',
    sourceUnitId: sourceId === undefined
      ? undefined
      : world.stores.identity.require(sourceId).id,
    cause,
  })
  processEcsDeathTriggers(world, targetId, actorId, actions)
  if (sourceId !== undefined &&
      world.stores.identity.require(sourceId).team !==
      world.stores.identity.require(targetId).team) {
    applyEcsOnKillEffects(world, sourceId, targetId, actions)
    processEcsKillTriggers(world, sourceId, targetId, actions)
    replicateEcsKiller(world, sourceId, targetId, actions)
  }
  spawnEcsDeathHazard(world, targetId, actions)
  return true
}

function replicateEcsKiller(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
): void {
  const sourceIdentity = world.stores.identity.require(sourceId)
  const targetIdentity = world.stores.identity.require(targetId)
  if (sourceIdentity.team === targetIdentity.team ||
      !world.stores.lifecycle.require(sourceId).replicateOnKill) return
  const target = world.stores.transform.require(targetId)
  const cloneExternalId = world.allocateExternalId('clone')
  world.queueUnitClone(sourceId, cloneExternalId, target.x, target.y)
  actions.push({
    unitId: sourceIdentity.id,
    type: 'spawn',
    toX: target.x,
    toY: target.y,
    spawnType: sourceIdentity.type,
    spawnTeam: sourceIdentity.team,
    spawnMaxHp: world.stores.vitality.require(sourceId).maxHp,
    targetId: cloneExternalId,
  })
}

function startDeathReassembly(
  world: CombatWorld,
  targetId: EntityId,
  actions: BattleAction[],
): void {
  const vitality = world.stores.vitality.require(targetId)
  const config = vitality.reassemblyConfig
  if (!config || vitality.reassemblyState ||
      (vitality.reassemblyTriggersUsed ?? 0) >= Math.max(1, config.maxTriggers ?? 1)) {
    return
  }
  vitality.reassemblyTriggersUsed = (vitality.reassemblyTriggersUsed ?? 0) + 1
  vitality.reassemblyState = {
    remainingTicks: Math.max(0, Math.floor(config.delayTicks)),
    hpPercent: Math.max(0.01, Math.min(1, config.hpPercent ?? 1)),
    sourceUnitId: world.stores.identity.require(targetId).id,
  }
  world.setUnitCapability(targetId, 'reassemblyCapability', true)
  const target = world.stores.identity.require(targetId).id
  actions.push({
    unitId: target,
    type: 'reassembly_start',
    targetId: target,
    value: vitality.reassemblyState.remainingTicks,
  })
}

function spawnEcsDeathHazard(
  world: CombatWorld,
  targetId: EntityId,
  actions: BattleAction[],
): void {
  const lifecycle = world.stores.lifecycle.require(targetId)
  if (!lifecycle.onDeathPuddle) return
  const identity = world.stores.identity.require(targetId)
  const transform = world.stores.transform.require(targetId)
  const vitality = world.stores.vitality.require(targetId)
  const hazard: SimHazard = {
    id: world.allocateExternalId('hazard'),
    team: identity.team,
    type: lifecycle.onDeathPuddle,
    x: transform.x,
    y: transform.y,
    radius: 50,
    damagePerTick: lifecycle.onDeathPuddle === 'acid'
      ? Math.floor(vitality.maxHp * 0.1)
      : 10,
    duration: 40,
    sourceUnitId: identity.id,
  }
  world.queueHazardCreation(hazard)
  actions.push({
    unitId: identity.id,
    type: 'hazard_spawn',
    hazardId: hazard.id,
    statusType: hazard.type,
    toX: hazard.x,
    toY: hazard.y,
    radius: hazard.radius,
  })
}
