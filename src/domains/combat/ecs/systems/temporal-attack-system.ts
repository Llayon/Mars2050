import type { BattleAction } from '../../combat.actions'
import type { RuntimeActionContext } from '../../combat.runtime'
import { chooseHackControlMode } from '../../combat.control-mode'
import type { AbilityEffect } from '../../combat.ability.types'
import type { AttackDeliveryConfig } from '../../combat.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { AttackTimelineState, ImpactPositionPolicy } from '../pending-impacts'
import { CombatInvariantError } from '../combat-invariant-error'
import { captureLiveDamageSource } from '../damage-source'
import { getEcsActionCooldown } from './action-setup'
import { evaluateDamageExpression, evaluateLaunchRawDamage } from './temporal-impact-ability-system'

export type TemporalDispatchResult =
  | { handled: false; acted: false }
  | { handled: true; acted: boolean; state: 'windup_started' | 'windup_active' | 'blocked' }

export function runTemporalAttack(
  world: CombatWorld, entityId: EntityId, targetId: EntityId,
  actions: BattleAction[], context: RuntimeActionContext,
): TemporalDispatchResult {
  const weapon = world.stores.weapon.require(entityId)
  const delivery = weapon.delivery
  if (!delivery || delivery.kind === 'instant') return { handled: false, acted: false }
  const temporalPlan = world.stores.runtimeRules.require(entityId).temporalPlan
  if (!temporalPlan || temporalPlan.delivery.kind !== delivery.kind) {
    throw new CombatInvariantError(`Missing compiled temporal plan for ${world.stores.identity.require(entityId).id}`)
  }
  const timelines = world.resources.get('temporalAttacks') ?? new Map()
  world.resources.set('temporalAttacks', timelines)
  if (timelines.has(entityId)) return { handled: true, acted: true, state: 'windup_active' }

  const target = world.stores.transform.require(targetId)
  const identity = world.stores.identity.require(targetId)
  const controlMode = getEffectiveTemporalControlMode(world, entityId)
  if (controlMode === 'disable') return { handled: true, acted: false, state: 'blocked' }
  const positionPolicy = getImpactPositionPolicy(delivery)
  const timeline: AttackTimelineState = {
    targetId,
    targetExternalId: identity.id,
    targetX: target.x,
    targetY: target.y,
    aimX: target.x,
    aimY: target.y,
    kind: delivery.kind,
    startedTick: context.tick,
    minimumLaunchTick: context.tick + Math.max(1, delivery.windupTicks),
    positionPolicy,
    controlMode: controlMode ?? 'none',
  }
  timelines.set(entityId, timeline)
  actions.push({
    unitId: world.stores.identity.require(entityId).id,
    type: 'attack_windup',
    targetId: identity.id,
    launchTick: timeline.minimumLaunchTick,
    projectileKind: delivery.kind,
    toX: timeline.aimX,
    toY: timeline.aimY,
  })
  return { handled: true, acted: true, state: 'windup_started' }
}

export function runTemporalTimelineSystem(
  world: CombatWorld,
  context: { tick: number; actions: BattleAction[] },
): void {
  const timelines = world.resources.require('temporalAttacks')
  const ordered = [...timelines.entries()]
    .sort((left, right) => world.stores.identity.require(left[0]).id.localeCompare(world.stores.identity.require(right[0]).id))
  for (const [entityId, timeline] of ordered) {
    if (!timelines.has(entityId)) continue
    const vitality = world.stores.vitality.get(entityId)
    if (!vitality || vitality.isDead) {
      cancelTemporalTimeline(world, entityId, timeline, context.actions, 'source_dead')
      continue
    }
    const currentMode = getEffectiveTemporalControlMode(world, entityId)
    if (currentMode === 'disable') {
      cancelTemporalTimeline(world, entityId, timeline, context.actions, 'status_blocked')
      continue
    }
    const normalizedMode = currentMode ?? 'none'
    if (normalizedMode !== timeline.controlMode) {
      cancelTemporalTimeline(world, entityId, timeline, context.actions, 'control_mode_changed')
      continue
    }
    if (context.tick < timeline.minimumLaunchTick) continue
    const target = world.stores.transform.get(timeline.targetId)
    const targetAlive = Boolean(target && !world.stores.vitality.require(timeline.targetId).isDead)
    if (!targetAlive && timeline.positionPolicy === 'tracked_target') {
      cancelTemporalTimeline(world, entityId, timeline, context.actions, 'target_lost')
      continue
    }
    const aim = timeline.positionPolicy === 'captured_at_windup'
      ? { x: timeline.aimX, y: timeline.aimY }
      : targetAlive && target
        ? { x: target.x, y: target.y }
        : { x: timeline.aimX, y: timeline.aimY }
    const source = world.stores.transform.require(entityId)
    const facing = Math.atan2(aim.y - source.y, aim.x - source.x)
    if (Math.abs(normalizeAngle(facing - source.currentAngle)) > 0.26) continue
    timelines.delete(entityId)
    launchTemporalAttack(world, entityId, timeline, aim, context.actions, context.tick)
  }
}

function launchTemporalAttack(
  world: CombatWorld,
  entityId: EntityId,
  timeline: AttackTimelineState,
  aim: { x: number; y: number },
  actions: BattleAction[],
  tick: number,
): void {
  const identity = world.stores.identity.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const delivery = weapon.delivery
  if (!delivery || delivery.kind === 'instant') return
  const combat = world.stores.combat.require(entityId)
  const sourceContext = captureLiveDamageSource(world, entityId)
  const source = world.stores.transform.require(entityId)
  const distance = Math.hypot(aim.x - source.x, aim.y - source.y)
  const flight = delivery.kind === 'projectile'
    ? Math.max(1, Math.ceil(distance / Math.max(1, delivery.speed)))
    : Math.max(1, delivery.flightTicks)
  const queue = world.resources.require('pendingImpacts')
  const temporalPlan = world.stores.runtimeRules.require(entityId).temporalPlan
  if (!temporalPlan || temporalPlan.delivery.kind !== delivery.kind) {
    throw new CombatInvariantError(`Missing compiled temporal plan for ${identity.id}`)
  }
  const shellPlan = temporalPlan.barrage
  const impacts = delivery.kind === 'ground_targeted'
    ? shellPlan?.offsets ?? []
    : [{ x: 0, y: 0 }]
  if (delivery.kind === 'ground_targeted' && !shellPlan) {
    throw new CombatInvariantError(`Missing compiled barrage plan for ${identity.id}`)
  }
  const programs = structuredClone(temporalPlan.impactPrograms)
  const programDamage = programs.flatMap(program => program.groups.flatMap(group => group.effects))
    .filter((effect): effect is Extract<AbilityEffect, { kind: 'damage' }> => effect.kind === 'damage')
    .reduce((sum, effect) => sum + evaluateDamageExpression(effect, sourceContext), 0)
  for (const [index, offset] of impacts.entries()) {
    const x = aim.x + offset.x
    const y = aim.y + offset.y
    const payload = delivery.kind === 'ground_targeted'
      ? {
          kind: 'area' as const,
          damage: Math.floor(sourceContext.attack * shellPlan!.damageMultiplier),
          radius: shellPlan!.radius,
          maxTargets: shellPlan!.maxTargets,
        }
      : { kind: 'direct' as const, damage: sourceContext.attack, targetId: timeline.targetId, targetExternalId: timeline.targetExternalId }
    const launchRaw = delivery.kind === 'ground_targeted'
      ? payload.damage + programDamage
      : programDamage > 0 ? programDamage : payload.damage
    const impact = queue.enqueue({
      sourceId: entityId,
      sourceExternalId: identity.id,
      sourceTeam: identity.team,
      targetTeam: world.stores.identity.require(timeline.targetId).team,
      hostileTeamAtLaunch: world.stores.identity.require(timeline.targetId).team,
      canTargetAir: combat.canTargetAir,
      canTargetGround: true,
      sourceContext,
      targetId: delivery.kind === 'ground_targeted' ? undefined : timeline.targetId,
      targetX: x,
      targetY: y,
      launchTick: tick,
      impactTick: tick + flight + (delivery.kind === 'ground_targeted' ? index * shellPlan!.impactIntervalTicks : 0),
      kind: delivery.kind,
      positionPolicy: timeline.positionPolicy,
      payload,
      interceptionDamage: evaluateLaunchRawDamage(sourceContext, launchRaw),
      interceptable: delivery.interceptable,
      programs,
    })
    actions.push({
      unitId: identity.id,
      type: 'projectile_launch',
      targetId: timeline.targetExternalId,
      impactId: impact.id,
      launchTick: tick,
      impactTick: impact.impactTick,
      projectileKind: delivery.kind,
      fromX: source.x,
      fromY: source.y,
      toX: x,
      toY: y,
    })
  }
  combat.actionCooldown = getEcsActionCooldown(world, entityId)
  actions.push({ unitId: identity.id, type: 'attack', targetId: timeline.targetExternalId, toX: aim.x, toY: aim.y })
}


export function cancelTemporalTimeline(
  world: CombatWorld,
  entityId: EntityId,
  timeline: AttackTimelineState,
  actions: BattleAction[],
  reason: NonNullable<BattleAction['cancelReason']>,
): void {
  world.resources.require('temporalAttacks').delete(entityId)
  actions.push({
    unitId: world.stores.identity.require(entityId).id,
    type: 'attack_cancel',
    targetId: timeline.targetExternalId,
    cancelReason: reason,
  })
}

function getImpactPositionPolicy(delivery: Exclude<AttackDeliveryConfig, { kind: 'instant' }>): ImpactPositionPolicy {
  if (delivery.kind === 'ground_targeted') return 'captured_at_windup'
  return delivery.homing === 'full' ? 'tracked_target' : 'captured_at_launch'
}

function getEffectiveTemporalControlMode(world: CombatWorld, entityId: EntityId): 'disable' | 'redirect' | 'confuse' | undefined {
  let mode: 'disable' | 'redirect' | 'confuse' | undefined
  for (const effect of world.stores.statusControl.require(entityId).statusEffects) {
    if (effect.duration <= 0) continue
    if (effect.type === 'emp') return 'disable'
    if (effect.type === 'hacked') mode = chooseHackControlMode(mode, effect.controlMode ?? 'disable')
  }
  return mode
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
