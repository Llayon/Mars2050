import type { BattleAction } from '../../combat.actions'
import type { AbilityEffect } from '../../combat.ability.types'
import type { CompiledAbilityProgram } from '../../combat.ability-compiler'
import type { RuntimeActionContext, RuntimeActionResult } from '../../combat.runtime'
import { chooseHackControlMode } from '../../combat.control-mode'
import type { BarrageAttackConfig } from '../../combat.primitives'
import type { AttackDeliveryConfig } from '../../combat.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { AttackTimelineState, ImpactPositionPolicy } from '../pending-impacts'
import { getEcsActionCooldown } from './action-setup'

export function runTemporalAttack(
  world: CombatWorld, entityId: EntityId, targetId: EntityId,
  actions: BattleAction[], context: RuntimeActionContext,
): RuntimeActionResult {
  const weapon = world.stores.weapon.require(entityId)
  const delivery = weapon.delivery
  if (!delivery || delivery.kind === 'instant') return { acted: false }
  if (delivery.kind === 'ground_targeted' && !compileBarrageShellPlan(weapon)) return { acted: false }
  const timelines = world.resources.get('temporalAttacks')
  if (!timelines) return { acted: false }
  if (timelines.has(entityId)) return { acted: true }

  const target = world.stores.transform.require(targetId)
  const identity = world.stores.identity.require(targetId)
  const controlMode = getEffectiveTemporalControlMode(world, entityId)
  if (controlMode === 'disable') return { acted: false }
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
  return { acted: true }
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
  const source = world.stores.transform.require(entityId)
  const distance = Math.hypot(aim.x - source.x, aim.y - source.y)
  const flight = delivery.kind === 'projectile'
    ? Math.max(1, Math.ceil(distance / Math.max(1, delivery.speed)))
    : Math.max(1, delivery.flightTicks)
  const queue = world.resources.require('pendingImpacts')
  const shellPlan = delivery.kind === 'ground_targeted' ? compileBarrageShellPlan(weapon) : undefined
  const impacts = delivery.kind === 'ground_targeted'
    ? getGroundShellOffsets(shellPlan)
    : [{ x: 0, y: 0 }]
  if (delivery.kind === 'ground_targeted' && !shellPlan) return
  for (const [index, offset] of impacts.entries()) {
    const x = aim.x + offset.x
    const y = aim.y + offset.y
    const payload = delivery.kind === 'ground_targeted'
      ? {
          kind: 'area' as const,
          damage: Math.floor(combat.attack * shellPlan!.damageMultiplier),
          radius: shellPlan!.radius,
          maxTargets: shellPlan!.maxTargets,
        }
      : { kind: 'direct' as const, damage: combat.attack, targetId: timeline.targetId, targetExternalId: timeline.targetExternalId }
    const impact = queue.enqueue({
      sourceId: entityId,
      sourceExternalId: identity.id,
      sourceTeam: identity.team,
      targetTeam: world.stores.identity.require(timeline.targetId).team,
      targetId: delivery.kind === 'ground_targeted' ? undefined : timeline.targetId,
      targetX: x,
      targetY: y,
      launchTick: tick,
      impactTick: tick + flight + (delivery.kind === 'ground_targeted' ? index * shellPlan!.impactIntervalTicks : 0),
      kind: delivery.kind,
      positionPolicy: timeline.positionPolicy,
      payload,
      interceptionDamage: payload.damage,
      interceptable: delivery.interceptable,
      programs: weapon.abilityPrograms?.filter(program => program.trigger.kind === 'projectile_impact'),
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

interface BarrageShellPlan {
  impacts: number
  radius: number
  spreadRadius: number
  damageMultiplier: number
  maxTargets: number | undefined
  impactIntervalTicks: number
}

function compileBarrageShellPlan(weapon: { barrageAttack?: BarrageAttackConfig; abilityPrograms?: CompiledAbilityProgram[] }): BarrageShellPlan | undefined {
  const authored = weapon.abilityPrograms?.flatMap(program => program.groups)
    .flatMap(group => group.effects)
    .find((effect): effect is Extract<AbilityEffect, { kind: 'barrage_attack' }> => effect.kind === 'barrage_attack')?.config
  const config = authored ?? weapon.barrageAttack
  if (!config) return undefined
  return {
    impacts: config.impacts,
    radius: config.radius,
    spreadRadius: config.spreadRadius,
    damageMultiplier: config.damageMultiplier,
    maxTargets: config.maxTargetsPerImpact ?? 6,
    impactIntervalTicks: config.impactIntervalTicks ?? 1,
  }
}

function getGroundShellOffsets(config: BarrageShellPlan | undefined): { x: number; y: number }[] {
  if (!config) return []
  const impacts = config.impacts
  const spread = config.spreadRadius
  return Array.from({ length: impacts }, (_, index) => {
    if (index === 0 || spread <= 0) return { x: 0, y: 0 }
    const angle = (index - 1) * 2.399963229728653
    const ring = 0.55 + (index % 3) * 0.225
    return { x: Math.cos(angle) * spread * ring, y: Math.sin(angle) * spread * ring }
  })
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
