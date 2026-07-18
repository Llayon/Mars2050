import type { BattleAction } from '../../combat.actions'
import type { SimHazard } from '../../combat.sim.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsOnKillEffects } from './on-kill-system'

export function resolveSimpleEcsDeath(
  world: CombatWorld,
  targetId: EntityId,
  sourceId: EntityId,
  actions: BattleAction[],
): boolean {
  const target = world.stores.vitality.require(targetId)
  if (target.isDead || target.hp > 0) return false
  target.isDead = true
  actions.push({
    unitId: world.stores.identity.require(targetId).id,
    type: 'die',
    sourceUnitId: world.stores.identity.require(sourceId).id,
    cause: 'weapon',
  })
  applyEcsOnKillEffects(world, sourceId, targetId, actions)
  spawnEcsDeathHazard(world, targetId, actions)
  return true
}

export function canResolveSimpleEcsDeath(world: CombatWorld, entityId: EntityId): boolean {
  const vitality = world.stores.vitality.require(entityId)
  const lifecycle = world.stores.lifecycle.require(entityId)
  return !vitality.resurrectOnce && !vitality.reassemblyConfig &&
    !lifecycle.triggerEffects?.length
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
    id: `hazard_${Math.floor(world.resources.require('rng').next() * 1000000)}`,
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
  world.hazards.push(hazard)
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
