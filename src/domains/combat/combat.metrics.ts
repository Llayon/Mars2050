import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'
import { getSizeRadius } from './combat.utils'
import { isMeleeEngagementReady } from './combat.melee-engagement'

export interface BattleSimulationOptions {
  trackMetrics?: boolean
}

export interface CombatMetrics {
  firstAttackTick: number | null
  battleDurationTicks: number
  targetSwitches: number
  averageOverlap: number
  maxOverlap: number
  averageTimeToEngage: number | null
  averageEngagementDistance: number | null
  meleeSlotWaitTicks: number
  stuckTicksByUnitType: Record<string, number>
  targetSwitchesByUnitType: Record<string, number>
  damageByUnitType: Record<string, number>
  damageTakenByUnitType: Record<string, number>
  healingDoneByUnitType: Record<string, number>
  overkillDamage: number
}

export interface CombatMetricsCollector {
  firstAttackTick: number | null
  targetSwitches: number
  totalOverlap: number
  overlapSamples: number
  maxOverlap: number
  damageByUnitType: Record<string, number>
  damageTakenByUnitType: Record<string, number>
  healingDoneByUnitType: Record<string, number>
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

export function createCombatMetrics(units: SimUnit[]): CombatMetricsCollector {
  return {
    firstAttackTick: null,
    targetSwitches: 0,
    totalOverlap: 0,
    overlapSamples: 0,
    maxOverlap: 0,
    damageByUnitType: {},
    damageTakenByUnitType: {},
    healingDoneByUnitType: {},
    targetSwitchesByUnitType: {},
    stuckTicksByUnitType: {},
    overkillDamage: 0,
    meleeSlotWaitTicks: 0,
    engagementDistanceTotal: 0,
    engagementDistanceSamples: 0,
    hpByUnitId: new Map(units.map(unit => [unit.id, unit.hp])),
    firstEngageTickByUnitId: new Map(),
    lastTargetByUnitId: new Map(),
  }
}

export function recordCombatActions(
  metrics: CombatMetricsCollector,
  tick: number,
  actions: BattleAction[],
  units: SimUnit[]
): void {
  const unitById = new Map(units.map(unit => [unit.id, unit]))

  for (const action of actions) {
    if (action.type === 'attack') recordAttackIntent(metrics, tick, action, unitById)
    if (action.type === 'damage') recordDamageAction(metrics, action, unitById)
    if (action.type === 'heal') recordHealAction(metrics, action, unitById)
    if (action.type === 'die') metrics.hpByUnitId.set(action.unitId, 0)
  }
}

export function recordCombatTick(metrics: CombatMetricsCollector, units: SimUnit[]): void {
  recordTargetSwitches(metrics, units)
  recordMovementStateMetrics(metrics, units)
  recordOverlap(metrics, units)
}

export function finalizeCombatMetrics(
  metrics: CombatMetricsCollector,
  battleDurationTicks: number
): CombatMetrics {
  return {
    firstAttackTick: metrics.firstAttackTick,
    battleDurationTicks,
    targetSwitches: metrics.targetSwitches,
    averageOverlap: metrics.overlapSamples > 0 ? metrics.totalOverlap / metrics.overlapSamples : 0,
    maxOverlap: metrics.maxOverlap,
    averageTimeToEngage: getAverageTimeToEngage(metrics),
    averageEngagementDistance: metrics.engagementDistanceSamples > 0 ? metrics.engagementDistanceTotal / metrics.engagementDistanceSamples : null,
    meleeSlotWaitTicks: metrics.meleeSlotWaitTicks,
    stuckTicksByUnitType: metrics.stuckTicksByUnitType,
    targetSwitchesByUnitType: metrics.targetSwitchesByUnitType,
    damageByUnitType: metrics.damageByUnitType,
    damageTakenByUnitType: metrics.damageTakenByUnitType,
    healingDoneByUnitType: metrics.healingDoneByUnitType,
    overkillDamage: metrics.overkillDamage,
  }
}

function recordAttackIntent(
  metrics: CombatMetricsCollector,
  tick: number,
  action: BattleAction,
  unitById: Map<string, SimUnit>
): void {
  if (metrics.firstAttackTick === null) metrics.firstAttackTick = tick
  if (!metrics.firstEngageTickByUnitId.has(action.unitId)) metrics.firstEngageTickByUnitId.set(action.unitId, tick)

  if (!action.targetId) return
  const target = unitById.get(action.targetId)
  const attacker = unitById.get(action.unitId)
  if (attacker && target) {
    metrics.engagementDistanceTotal += Math.hypot(attacker.x - target.x, attacker.y - target.y)
    metrics.engagementDistanceSamples++
  }
}

function recordDamageAction(
  metrics: CombatMetricsCollector,
  action: BattleAction,
  unitById: Map<string, SimUnit>
): void {
  const damage = Math.max(0, action.damage ?? 0)
  const attackerType = unitById.get(action.unitId)?.type ?? 'unknown'
  metrics.damageByUnitType[attackerType] = (metrics.damageByUnitType[attackerType] ?? 0) + damage

  if (!action.targetId || damage <= 0) return
  const target = unitById.get(action.targetId)
  if (target) metrics.damageTakenByUnitType[target.type] = (metrics.damageTakenByUnitType[target.type] ?? 0) + damage
  const previousHp = metrics.hpByUnitId.get(action.targetId) ?? unitById.get(action.targetId)?.hp ?? 0
  metrics.overkillDamage += Math.max(0, damage - Math.max(0, previousHp))
  metrics.hpByUnitId.set(action.targetId, Math.max(0, previousHp - damage))
}

function recordHealAction(
  metrics: CombatMetricsCollector,
  action: BattleAction,
  unitById: Map<string, SimUnit>
): void {
  if (!action.targetId) return
  const healerType = unitById.get(action.unitId)?.type ?? 'unknown'
  metrics.healingDoneByUnitType[healerType] = (metrics.healingDoneByUnitType[healerType] ?? 0) + Math.max(0, action.damage ?? 0)
  const previousHp = metrics.hpByUnitId.get(action.targetId) ?? 0
  metrics.hpByUnitId.set(action.targetId, previousHp + Math.max(0, action.damage ?? 0))
}

function recordTargetSwitches(metrics: CombatMetricsCollector, units: SimUnit[]): void {
  for (const unit of units) {
    if (unit.isDead || !unit.attackTargetId) {
      metrics.lastTargetByUnitId.delete(unit.id)
      continue
    }

    const previousTarget = metrics.lastTargetByUnitId.get(unit.id)
    if (previousTarget && previousTarget !== unit.attackTargetId) {
      metrics.targetSwitches++
      metrics.targetSwitchesByUnitType[unit.type] = (metrics.targetSwitchesByUnitType[unit.type] ?? 0) + 1
    }
    metrics.lastTargetByUnitId.set(unit.id, unit.attackTargetId)
  }
}

function recordMovementStateMetrics(metrics: CombatMetricsCollector, units: SimUnit[]): void {
  const unitById = new Map(units.map(unit => [unit.id, unit]))
  for (const unit of units) {
    if (unit.isDead) continue
    if ((unit.stuckTicks ?? 0) > 0) {
      metrics.stuckTicksByUnitType[unit.type] = (metrics.stuckTicksByUnitType[unit.type] ?? 0) + 1
    }

    if (!unit.meleeSlotTargetId || unit.meleeSlotIndex === undefined) continue
    const target = unitById.get(unit.meleeSlotTargetId)
    if (target && !target.isDead && !isMeleeEngagementReady(unit, target)) metrics.meleeSlotWaitTicks++
  }
}

function recordOverlap(metrics: CombatMetricsCollector, units: SimUnit[]): void {
  const alive = units.filter(unit => !unit.isDead)
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const first = alive[i]
      const second = alive[j]
      if (first.isFlying !== second.isFlying) continue

      const minDistance = (getSizeRadius(first.size) + getSizeRadius(second.size)) * 0.95
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      const overlap = Math.max(0, minDistance - distance)
      if (overlap <= 0) continue

      metrics.totalOverlap += overlap
      metrics.maxOverlap = Math.max(metrics.maxOverlap, overlap)
      metrics.overlapSamples++
    }
  }
}

function getAverageTimeToEngage(metrics: CombatMetricsCollector): number | null {
  if (metrics.firstEngageTickByUnitId.size === 0) return null
  let total = 0
  for (const tick of metrics.firstEngageTickByUnitId.values()) total += tick
  return total / metrics.firstEngageTickByUnitId.size
}
