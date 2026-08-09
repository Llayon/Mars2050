import type { BattleAction, BattleResult } from '@/domains/combat/combat.types'
import type { OrderingProbeResult } from './combat-ordering-probes'
import { firstSemanticPlanningDivergence, type InitialPlanningSnapshot, type PlanningDivergence } from './combat-ordering-runtime-probes'

export interface OrderingDivergence {
  seed: number
  tick: number
  actionIndex: number
  type: string
  category: string
  source: string
  target: string | null
}

export interface BattlePairDiagnostics {
  targetSemanticChanges: boolean
  orderedSemanticDivergence: OrderingDivergence | null
  canonicalEventSetDivergence: OrderingDivergence | null
  firstCommittedMovementDivergence: OrderingDivergence | null
  firstDamageDivergence: OrderingDivergence | null
  firstStatusDivergence: OrderingDivergence | null
  firstDeathDivergence: OrderingDivergence | null
  finalStateChanged: boolean
  meaningfulBehaviorChanged: boolean
}

export interface PlanningPairDiagnostics {
  firstPlanningDivergence: (PlanningDivergence & { seed: number }) | null
  semanticPlanningDivergence: (PlanningDivergence & { seed: number }) | null
  processingOrderChanged: boolean
}

interface NormalizedEvent {
  key: string
  type: string
  category: string
  source: string
  target: string | null
}

export function compareBattlePairs(
  seed: number,
  reference: { result: BattleResult; probe: OrderingProbeResult },
  candidate: { result: BattleResult; probe: OrderingProbeResult },
): BattlePairDiagnostics {
  const targetSemanticChanges = hasTargetSemanticDifference(reference, candidate)
  const orderedSemanticDivergence = firstDivergence(seed, reference, candidate, false)
  const canonicalEventSetDivergence = firstDivergence(seed, reference, candidate, true)
  const firstCommittedMovementDivergence = firstDivergence(seed, reference, candidate, true, 'movement')
  const firstDamageDivergence = firstDivergence(seed, reference, candidate, true, 'damage')
  const firstStatusDivergence = firstDivergence(seed, reference, candidate, true, 'status')
  const firstDeathDivergence = firstDivergence(seed, reference, candidate, true, 'death')
  const finalStateChanged = JSON.stringify(projectedState(reference)) !== JSON.stringify(projectedState(candidate))
  return {
    targetSemanticChanges,
    orderedSemanticDivergence,
    canonicalEventSetDivergence,
    firstCommittedMovementDivergence,
    firstDamageDivergence,
    firstStatusDivergence,
    firstDeathDivergence,
    finalStateChanged,
    meaningfulBehaviorChanged: targetSemanticChanges || canonicalEventSetDivergence !== null || finalStateChanged,
  }
}

export function comparePlanningPairs(
  seed: number,
  reference: InitialPlanningSnapshot,
  candidate: InitialPlanningSnapshot,
  firstPlanningDivergence: (left: InitialPlanningSnapshot, right: InitialPlanningSnapshot) => PlanningDivergence | null,
): PlanningPairDiagnostics {
  const divergence = firstPlanningDivergence(reference, candidate)
  const semanticDivergence = firstSemanticPlanningDivergence(reference, candidate)
  return {
    firstPlanningDivergence: divergence ? { ...divergence, seed } : null,
    semanticPlanningDivergence: semanticDivergence ? { ...semanticDivergence, seed } : null,
    processingOrderChanged: processingOrder(reference) !== processingOrder(candidate),
  }
}

function hasTargetSemanticDifference(
  reference: { result: BattleResult; probe: OrderingProbeResult },
  candidate: { result: BattleResult; probe: OrderingProbeResult },
): boolean {
  const left = targetKeys(reference).sort(compareCodeUnit)
  const right = targetKeys(candidate).sort(compareCodeUnit)
  return JSON.stringify(left) !== JSON.stringify(right)
}

function targetKeys(run: { result: BattleResult; probe: OrderingProbeResult }): string[] {
  return run.result.logs.flatMap(tick => tick.actions
    .filter(action => action.targetId !== undefined)
    .map(action => `${tick.tick}|${action.type}|${semanticId(action.unitId, run.probe)}|${semanticId(action.targetId ?? '', run.probe)}`))
}

function firstDivergence(
  seed: number,
  reference: { result: BattleResult; probe: OrderingProbeResult },
  candidate: { result: BattleResult; probe: OrderingProbeResult },
  canonical: boolean,
  category?: string,
): OrderingDivergence | null {
  const leftTicks = tickMap(reference.result)
  const rightTicks = tickMap(candidate.result)
  for (const tick of tickNumbers(leftTicks, rightTicks)) {
    let left = (leftTicks.get(tick) ?? []).map(action => normalizeEvent(action, reference.probe))
    let right = (rightTicks.get(tick) ?? []).map(action => normalizeEvent(action, candidate.probe))
    if (category) {
      left = left.filter(event => event.category === category)
      right = right.filter(event => event.category === category)
    }
    if (canonical) {
      left.sort(compareEvent)
      right.sort(compareEvent)
    }
    const count = Math.max(left.length, right.length)
    for (let index = 0; index < count; index++) {
      if (left[index]?.key !== right[index]?.key) {
        const event = right[index] ?? left[index]
        return { seed, tick, actionIndex: index, type: event?.type ?? 'missing', category: event?.category ?? category ?? 'other', source: event?.source ?? 'missing', target: event?.target ?? null }
      }
    }
  }
  return null
}

function normalizeEvent(action: BattleAction, probe: OrderingProbeResult): NormalizedEvent {
  const source = semanticId(action.unitId, probe)
  const target = action.targetId === undefined ? null : semanticId(action.targetId, probe)
  const key = JSON.stringify({
    type: action.type, source, target,
    fromX: action.fromX, fromY: action.fromY, toX: action.toX, toY: action.toY,
    facingAngle: action.facingAngle, motionKind: action.motionKind, isWalking: action.isWalking,
    damage: action.damage, bonusDamage: action.bonusDamage, damageKind: action.damageKind,
    statusType: action.statusType, cause: action.cause, markEvent: action.markEvent,
    sourceUnitType: action.sourceUnitType, sourceTeam: action.sourceTeam, value: action.value,
    cancelReason: action.cancelReason,
  })
  return { key, type: action.type, category: eventCategory(action.type), source, target }
}

function projectedState(run: { result: BattleResult; probe: OrderingProbeResult }): Array<{ key: string; hp: number; alive: boolean }> {
  const survivors = new Map(run.result.survivors.map(unit => [unit.id, unit]))
  return run.result.initialState.map(unit => {
    const survivor = survivors.get(unit.id)
    return { key: semanticId(unit.id, run.probe), hp: survivor?.hp ?? 0, alive: survivor !== undefined }
  }).sort((left, right) => compareCodeUnit(left.key, right.key))
}

function processingOrder(snapshot: InitialPlanningSnapshot): string {
  return snapshot.records.map(record => `${record.groupOrdinal}:${record.processingOrdinal}:${record.semanticActor}`).join('|')
}

function semanticId(id: string, probe: OrderingProbeResult): string {
  const identity = probe.semanticByExternalId.get(id)
  return identity ? `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}` : id
}

function eventCategory(type: string): string {
  if (type === 'move' || type === 'knockback' || type === 'teleport') return 'movement'
  if (type === 'damage' || type === 'unit_blocked_damage') return 'damage'
  if (type === 'status_apply' || type === 'target_mark') return 'status'
  if (type === 'attack' || type.endsWith('_attack')) return 'attack'
  if (type === 'die' || type === 'death') return 'death'
  return 'other'
}

function tickMap(result: BattleResult): Map<number, BattleAction[]> {
  return new Map(result.logs.map(item => [item.tick, item.actions]))
}

function tickNumbers(...maps: Map<number, BattleAction[]>[]): number[] {
  return [...new Set(maps.flatMap(map => [...map.keys()]))].sort((left, right) => left - right)
}

function compareEvent(left: NormalizedEvent, right: NormalizedEvent): number {
  return compareCodeUnit(left.key, right.key)
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
