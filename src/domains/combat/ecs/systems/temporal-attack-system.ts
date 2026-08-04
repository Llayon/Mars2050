import type { BattleAction } from '../../combat.actions'
import type { RuntimeActionContext, RuntimeActionResult } from '../../combat.runtime'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsActionCooldown } from './action-setup'

export function runTemporalAttack(
  world: CombatWorld, entityId: EntityId, targetId: EntityId,
  actions: BattleAction[], context: RuntimeActionContext,
): RuntimeActionResult {
  const weapon = world.stores.weapon.require(entityId)
  const delivery = weapon.delivery
  if (!delivery || delivery.kind === 'instant') return { acted: false }
  const timelines = world.resources.get('temporalAttacks')
  if (!timelines) return { acted: false }
  const existing = timelines.get(entityId)
  if (existing) {
    if (world.stores.vitality.require(entityId).isDead || world.stores.statusControl.require(entityId).statusEffects.some(effect => effect.duration > 0 && (effect.type === 'emp' || effect.type === 'hacked'))) {
      timelines.delete(entityId)
      actions.push({ unitId: world.stores.identity.require(entityId).id, type: 'attack_cancel', targetId: world.stores.identity.require(targetId).id })
      return { acted: true }
    }
    if (existing.remainingTicks > 1) {
      existing.remainingTicks--
      return { acted: true }
    }
    timelines.delete(entityId)
    return launchTemporalAttack(world, entityId, existing, actions, context.tick)
  }
  const target = world.stores.transform.require(targetId)
  const timeline = {
    targetId, targetX: target.x, targetY: target.y,
    remainingTicks: Math.max(1, delivery.windupTicks),
    kind: delivery.kind, startedTick: context.tick,
  }
  timelines.set(entityId, timeline)
  actions.push({ unitId: world.stores.identity.require(entityId).id, type: 'attack_windup', targetId: world.stores.identity.require(targetId).id, launchTick: context.tick + timeline.remainingTicks, projectileKind: delivery.kind })
  return { acted: true }
}

function launchTemporalAttack(world: CombatWorld, entityId: EntityId, timeline: { targetId: EntityId; targetX: number; targetY: number; kind: 'projectile' | 'ground_targeted'; startedTick: number }, actions: BattleAction[], tick: number): RuntimeActionResult {
  const identity = world.stores.identity.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const delivery = weapon.delivery
  const combat = world.stores.combat.require(entityId)
  const target = world.stores.transform.get(timeline.targetId)
  const distance = target ? Math.hypot(target.x - world.stores.transform.require(entityId).x, target.y - world.stores.transform.require(entityId).y) : 1
  const flight = timeline.kind === 'projectile' ? Math.max(1, Math.ceil(distance / Math.max(1, weapon.delivery?.kind === 'projectile' ? weapon.delivery.speed : 80))) : (weapon.delivery?.kind === 'ground_targeted' ? weapon.delivery.flightTicks : 1)
  const queue = world.resources.require('pendingImpacts')
  const offsets = timeline.kind === 'ground_targeted' ? [[0, 0], [-42, 0], [42, 0], [0, 42]] : [[0, 0]]
  const impacts = offsets.map(([offsetX, offsetY], index) => queue.enqueue({
    sourceId: entityId, sourceExternalId: identity.id, sourceTeam: identity.team,
    targetId: index === 0 ? timeline.targetId : undefined,
    targetX: timeline.targetX + offsetX, targetY: timeline.targetY + offsetY,
    launchTick: tick, impactTick: tick + flight + (index === 0 ? 0 : index), kind: timeline.kind,
    directDamage: index === 0 ? combat.attack : 0,
    areaDamage: timeline.kind === 'ground_targeted' ? Math.floor(combat.attack * 0.5) : 0,
    areaRadius: timeline.kind === 'ground_targeted' ? 90 : 0,
    interceptable: delivery?.kind === 'projectile' || delivery?.kind === 'ground_targeted' ? delivery.interceptable : true,
    programs: weapon.abilityPrograms?.filter(program => program.trigger.kind === 'projectile_impact'),
  }))
  combat.actionCooldown = getEcsActionCooldown(world, entityId)
  actions.push({ unitId: identity.id, type: 'attack', targetId: world.stores.identity.require(timeline.targetId).id })
  for (const impact of impacts) actions.push({ unitId: identity.id, type: 'projectile_launch', targetId: timeline.targetId ? world.stores.identity.require(timeline.targetId).id : undefined, impactId: impact.id, launchTick: tick, impactTick: impact.impactTick, projectileKind: timeline.kind })
  return { acted: true }
}
