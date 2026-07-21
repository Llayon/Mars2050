import type { BattleAction } from './combat.actions'
import { collectOverlapMetrics } from './combat.metrics-overlap'
import type { TimeoutPolicy } from './combat.result'
import type { CombatWorld } from './ecs/combat-world'
import { isEcsMeleeEngagementReady } from './ecs/movement-positioning'

export interface BattleSimulationOptions {
  trackMetrics?: boolean
  maxTicks?: number
  timeoutPolicy?: TimeoutPolicy
  profile?: boolean
}

export interface CombatMetrics {
  firstAttackTick: number | null
  battleDurationTicks: number
  targetSwitches: number
  overlapSamples: number
  averageOverlap: number
  maxOverlap: number
  averageOverlapRatio: number
  maxOverlapRatio: number
  severeOverlapSamples: number
  averageTimeToEngage: number | null
  averageEngagementDistance: number | null
  meleeSlotWaitTicks: number
  stuckTicksByUnitType: Record<string, number>
  targetSwitchesByUnitType: Record<string, number>
  damageByUnitType: Record<string, number>
  damageTakenByUnitType: Record<string, number>
  healingDoneByUnitType: Record<string, number>
  killsByUnitType: Record<string, number>
  overkillDamage: number
}

export interface CombatMetricsCollector {
  firstAttackTick: number | null
  targetSwitches: number
  totalOverlap: number
  totalOverlapRatio: number
  overlapSamples: number
  maxOverlap: number
  maxOverlapRatio: number
  severeOverlapSamples: number
  damageByUnitType: Record<string, number>
  damageTakenByUnitType: Record<string, number>
  healingDoneByUnitType: Record<string, number>
  killsByUnitType: Record<string, number>
  targetSwitchesByUnitType: Record<string, number>
  stuckTicksByUnitType: Record<string, number>
  overkillDamage: number
  meleeSlotWaitTicks: number
  engagementDistanceTotal: number
  engagementDistanceSamples: number
  hpByUnitId: Map<string, number>
  firstEngageTickByUnitId: Map<string, number>
  lastTargetByUnitId: Map<string, string>
}

export function createCombatMetrics(world: CombatWorld): CombatMetricsCollector {
  return {
    firstAttackTick: null,
    targetSwitches: 0,
    totalOverlap: 0,
    totalOverlapRatio: 0,
    overlapSamples: 0,
    maxOverlap: 0,
    maxOverlapRatio: 0,
    severeOverlapSamples: 0,
    damageByUnitType: {},
    damageTakenByUnitType: {},
    healingDoneByUnitType: {},
    killsByUnitType: {},
    targetSwitchesByUnitType: {},
    stuckTicksByUnitType: {},
    overkillDamage: 0,
    meleeSlotWaitTicks: 0,
    engagementDistanceTotal: 0,
    engagementDistanceSamples: 0,
    hpByUnitId: new Map(world.query(['identity', 'vitality'], true).map(entityId => [
      world.stores.identity.require(entityId).id,
      world.stores.vitality.require(entityId).hp,
    ])),
    firstEngageTickByUnitId: new Map(),
    lastTargetByUnitId: new Map(),
  }
}

export function recordCombatActions(
  metrics: CombatMetricsCollector,
  tick: number,
  actions: BattleAction[],
  world: CombatWorld,
): void {
  for (const action of actions) {
    if (action.type === 'attack') recordAttackIntent(metrics, tick, action, world)
    if (action.type === 'damage' || action.type === 'damage_share') recordDamageAction(metrics, action, world)
    if (action.type === 'heal') recordHealAction(metrics, action, world)
    if (action.type === 'die') recordDeathAction(metrics, action, world)
  }
}

export function recordCombatTick(metrics: CombatMetricsCollector, world: CombatWorld): void {
  recordTargetSwitches(metrics, world)
  recordMovementStateMetrics(metrics, world)
  recordOverlap(metrics, world)
}

export function finalizeCombatMetrics(
  metrics: CombatMetricsCollector,
  battleDurationTicks: number
): CombatMetrics {
  return {
    firstAttackTick: metrics.firstAttackTick,
    battleDurationTicks,
    targetSwitches: metrics.targetSwitches,
    overlapSamples: metrics.overlapSamples,
    averageOverlap: metrics.overlapSamples > 0 ? metrics.totalOverlap / metrics.overlapSamples : 0,
    maxOverlap: metrics.maxOverlap,
    averageOverlapRatio: metrics.overlapSamples > 0 ? metrics.totalOverlapRatio / metrics.overlapSamples : 0,
    maxOverlapRatio: metrics.maxOverlapRatio,
    severeOverlapSamples: metrics.severeOverlapSamples,
    averageTimeToEngage: getAverageTimeToEngage(metrics),
    averageEngagementDistance: metrics.engagementDistanceSamples > 0 ? metrics.engagementDistanceTotal / metrics.engagementDistanceSamples : null,
    meleeSlotWaitTicks: metrics.meleeSlotWaitTicks,
    stuckTicksByUnitType: metrics.stuckTicksByUnitType,
    targetSwitchesByUnitType: metrics.targetSwitchesByUnitType,
    damageByUnitType: metrics.damageByUnitType,
    damageTakenByUnitType: metrics.damageTakenByUnitType,
    healingDoneByUnitType: metrics.healingDoneByUnitType,
    killsByUnitType: metrics.killsByUnitType,
    overkillDamage: metrics.overkillDamage,
  }
}

function recordAttackIntent(
  metrics: CombatMetricsCollector,
  tick: number,
  action: BattleAction,
  world: CombatWorld,
): void {
  if (metrics.firstAttackTick === null) metrics.firstAttackTick = tick
  if (!metrics.firstEngageTickByUnitId.has(action.unitId)) metrics.firstEngageTickByUnitId.set(action.unitId, tick)

  if (!action.targetId) return
  const targetId = world.getEntityId(action.targetId)
  const attackerId = world.getEntityId(action.unitId)
  if (attackerId !== undefined && targetId !== undefined) {
    const attacker = world.stores.transform.require(attackerId)
    const target = world.stores.transform.require(targetId)
    metrics.engagementDistanceTotal += Math.hypot(attacker.x - target.x, attacker.y - target.y)
    metrics.engagementDistanceSamples++
  }
}

function recordDamageAction(metrics: CombatMetricsCollector, action: BattleAction, world: CombatWorld): void {
  const damage = Math.max(0, action.damage ?? 0)
  const attackerType = getUnitType(world, action.sourceUnitId ?? action.unitId)
  metrics.damageByUnitType[attackerType] = (metrics.damageByUnitType[attackerType] ?? 0) + damage

  if (!action.targetId || damage <= 0) return
  const targetType = getUnitType(world, action.targetId)
  if (targetType !== 'unknown') metrics.damageTakenByUnitType[targetType] = (metrics.damageTakenByUnitType[targetType] ?? 0) + damage
  const targetId = world.getEntityId(action.targetId)
  const currentHp = targetId === undefined ? 0 : world.stores.vitality.require(targetId).hp
  const previousHp = metrics.hpByUnitId.get(action.targetId) ?? currentHp
  metrics.overkillDamage += Math.max(0, damage - Math.max(0, previousHp))
  metrics.hpByUnitId.set(action.targetId, Math.max(0, previousHp - damage))
}

function recordHealAction(
  metrics: CombatMetricsCollector,
  action: BattleAction,
  world: CombatWorld,
): void {
  if (!action.targetId) return
  const healerType = getUnitType(world, action.sourceUnitId ?? action.unitId)
  metrics.healingDoneByUnitType[healerType] = (metrics.healingDoneByUnitType[healerType] ?? 0) + Math.max(0, action.damage ?? 0)
  const previousHp = metrics.hpByUnitId.get(action.targetId) ?? 0
  metrics.hpByUnitId.set(action.targetId, previousHp + Math.max(0, action.damage ?? 0))
}

function recordDeathAction(metrics: CombatMetricsCollector, action: BattleAction, world: CombatWorld): void {
  metrics.hpByUnitId.set(action.unitId, 0)
  if (!action.sourceUnitId) return
  const killerType = getUnitType(world, action.sourceUnitId)
  metrics.killsByUnitType[killerType] = (metrics.killsByUnitType[killerType] ?? 0) + 1
}

function recordTargetSwitches(metrics: CombatMetricsCollector, world: CombatWorld): void {
  for (const entityId of world.query(['identity', 'vitality', 'targeting', 'entityTargets'], true)) {
    const identity = world.stores.identity.require(entityId)
    const vitality = world.stores.vitality.require(entityId)
    const targetEntityId = world.stores.entityTargets.require(entityId).attackTarget
    const targetExternalId = targetEntityId === undefined ? undefined : world.stores.entityMeta.get(targetEntityId)?.externalId
    if (vitality.isDead || targetExternalId === undefined) {
      metrics.lastTargetByUnitId.delete(identity.id)
      continue
    }

    const previousTarget = metrics.lastTargetByUnitId.get(identity.id)
    if (previousTarget && previousTarget !== targetExternalId) {
      metrics.targetSwitches++
      metrics.targetSwitchesByUnitType[identity.type] = (metrics.targetSwitchesByUnitType[identity.type] ?? 0) + 1
    }
    metrics.lastTargetByUnitId.set(identity.id, targetExternalId)
  }
}

function recordMovementStateMetrics(metrics: CombatMetricsCollector, world: CombatWorld): void {
  for (const entityId of world.query(['identity', 'vitality', 'movement', 'targeting', 'entityTargets'])) {
    const identity = world.stores.identity.require(entityId)
    const movement = world.stores.movement.require(entityId)
    const targeting = world.stores.targeting.require(entityId)
    if ((movement.stuckTicks ?? 0) > 0)
      metrics.stuckTicksByUnitType[identity.type] = (metrics.stuckTicksByUnitType[identity.type] ?? 0) + 1

    const targetId = world.stores.entityTargets.require(entityId).meleeTarget
    if (targetId === undefined || targeting.meleeSlotIndex === undefined) continue
    if (!world.stores.vitality.require(targetId).isDead &&
        !isEcsMeleeEngagementReady(world, entityId, targetId)) metrics.meleeSlotWaitTicks++
  }
}

function recordOverlap(metrics: CombatMetricsCollector, world: CombatWorld): void {
  const units = world.query(['transform', 'vitality'], true).map(entityId => ({
    ...world.stores.transform.require(entityId),
    isDead: world.stores.vitality.require(entityId).isDead,
  }))
  const overlap = collectOverlapMetrics(units)
  metrics.totalOverlap += overlap.totalOverlap
  metrics.totalOverlapRatio += overlap.totalOverlapRatio
  metrics.overlapSamples += overlap.overlapSamples
  metrics.maxOverlap = Math.max(metrics.maxOverlap, overlap.maxOverlap)
  metrics.maxOverlapRatio = Math.max(metrics.maxOverlapRatio, overlap.maxOverlapRatio)
  metrics.severeOverlapSamples += overlap.severeOverlapSamples
}

function getUnitType(world: CombatWorld, externalId: string): string {
  const entityId = world.getEntityId(externalId)
  return entityId === undefined ? 'unknown' : world.stores.identity.get(entityId)?.type ?? 'unknown'
}

function getAverageTimeToEngage(metrics: CombatMetricsCollector): number | null {
  if (metrics.firstEngageTickByUnitId.size === 0) return null
  let total = 0
  for (const tick of metrics.firstEngageTickByUnitId.values()) total += tick
  return total / metrics.firstEngageTickByUnitId.size
}
