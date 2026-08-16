import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { captureMovementPipelineCell } from './combat-movement-pipeline-probes'
import { applyOrderingProbe, type OrderingProbeResult } from './combat-ordering-probes'
import { canonicalSerialize } from './combat-semantic-state-diff'
import {
  assertActorTurnMapping,
  prepareActorTurn,
  runDefaultActorTurnCell,
  runTracedActorTurn,
} from './combat-actor-turn-reservation-probes'
import type { ActorTurnCell } from './combat-actor-turn-reservation-types'
import type {
  ActorTurnIntentTrace,
  DiagnosticRecord,
  IntentGroupTrace,
  IntentTraceComparison,
  SemanticIntentKey,
} from './combat-actor-turn-intent-order-types'
import { compareFixedOrderTraces, compareOrderEffectTraces, type IntentTracePairComparison } from './combat-actor-turn-intent-order-comparison'
import type { ActorTurnTrace } from './combat-actor-turn-reservation-types'
import type { Stage0Checkpoint } from './combat-movement-pipeline-types'
import type { ActorTurnReplayOverrides } from './combat-actor-turn-reservation-execution'

export interface IntentOrderCell {
  label: 'IBB' | 'IBC' | 'ICB' | 'ICC'
  ids: 'baseline' | 'candidate'
  intentOrder: 'baseline' | 'candidate'
  trace: ActorTurnTrace & { intentExecution: ActorTurnIntentTrace }
}

export interface IntentOrderExperiment {
  baselineDefault: ActorTurnCell
  candidateDefault: ActorTurnCell
  baselineProductionOrder: SemanticIntentKey[]
  candidateProductionOrder: SemanticIntentKey[]
  cells: IntentOrderCell[]
  comparisons: {
    fixedBaselineOrder: IntentTracePairComparison
    fixedCandidateOrder: IntentTracePairComparison
    baselineIdsOrderEffect: IntentTracePairComparison
    candidateIdsOrderEffect: IntentTracePairComparison
  }
  preIntentEquivalent: boolean
  firstProductionIntentOrderDivergence: DiagnosticRecord | null
  firstExecutionDivergence: DiagnosticRecord | null
  firstActedResultDivergence: DiagnosticRecord | null
  firstActionDeltaDivergence: DiagnosticRecord | null
  firstLedgerDivergence: DiagnosticRecord | null
  firstFallbackRequestDivergence: DiagnosticRecord | null
  firstFallbackRequestPrefixDivergence: DiagnosticRecord | null
  firstPersistentStateDivergenceDuringIntentExecution: DiagnosticRecord | null
  firstGroup0EndpointDivergence: DiagnosticRecord | null
  fixedOrderIdContentEffect: boolean
  intentExecutionEffect: string
  overall: string
}

export function runIntentOrderExperiment(scenario: CombatBalanceScenario, seed: number, pr12Baseline: Stage0Checkpoint, pr12Candidate: Stage0Checkpoint): IntentOrderExperiment {
  const baselineProbe = applyOrderingProbe(scenario, 'baseline')
  const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
  const baselinePrepared = prepareActorTurn(scenario, seed, baselineProbe)
  const candidatePrepared = prepareActorTurn(scenario, seed, candidateProbe)
  assertActorTurnMapping(baselinePrepared, candidatePrepared)
  const baselineDefault = runDefaultActorTurnCell(scenario, seed, baselineProbe, 'BP', pr12Baseline)
  const candidateDefault = runDefaultActorTurnCell(scenario, seed, candidateProbe, 'CP', pr12Candidate)
  if (!defaultActorTurnEquivalent(baselineDefault) || !defaultActorTurnEquivalent(candidateDefault)) throw new Error('ACTOR_TURN_HARNESS_EQUIVALENCE_FAILED')
  const baselineOrder = baselineDefault.trace.groups.map(group => group.processedOrder)
  const baselineReference = runGroup0Reference(baselinePrepared, baselineProbe, baselineOrder)
  const candidateReference = runGroup0Reference(candidatePrepared, candidateProbe, baselineOrder)
  const baselineIntentOrder = requireIntentOrder(baselineReference)
  const candidateIntentOrder = requireIntentOrder(candidateReference)
  const cells = [
    runCell(scenario, seed, baselineProbe, 'IBB', baselineOrder, baselineIntentOrder),
    runCell(scenario, seed, baselineProbe, 'IBC', baselineOrder, candidateIntentOrder),
    runCell(scenario, seed, candidateProbe, 'ICB', baselineOrder, baselineIntentOrder),
    runCell(scenario, seed, candidateProbe, 'ICC', baselineOrder, candidateIntentOrder),
  ]
  const [ibb, ibc, icb, icc] = cells
  const fixedBaselineOrder = compareFixedOrderTraces(ibb.trace.intentExecution, icb.trace.intentExecution)
  const fixedCandidateOrder = compareFixedOrderTraces(ibc.trace.intentExecution, icc.trace.intentExecution)
  const baselineIdsOrderEffect = compareOrderEffectTraces(ibb.trace.intentExecution, ibc.trace.intentExecution)
  const candidateIdsOrderEffect = compareOrderEffectTraces(icb.trace.intentExecution, icc.trace.intentExecution)
  const preIntentEquivalent = comparePreIntent(ibb.trace.intentExecution.groups[0], ibc.trace.intentExecution.groups[0]) &&
    comparePreIntent(ibb.trace.intentExecution.groups[0], icb.trace.intentExecution.groups[0]) &&
    comparePreIntent(ibb.trace.intentExecution.groups[0], icc.trace.intentExecution.groups[0])
  const fixedOrderIdContentEffect = !fixedBaselineOrder.equivalent || !fixedCandidateOrder.equivalent
  const firstExecutionDivergence = firstOrderDifference(ibb, ibc)
  const firstActedResultDivergence = firstSemanticRecordDifference(ibb, ibc, 'acted')
  const firstActionDeltaDivergence = firstSemanticRecordDifference(ibb, ibc, 'normalizedActionDelta')
  const firstLedgerDivergence = firstSemanticRecordDifference(ibb, ibc, 'semanticLedgerDelta')
  const firstFallbackRequestDivergence = firstFallbackDifference(ibb, ibc, false)
  const firstFallbackRequestPrefixDivergence = firstFallbackDifference(ibb, ibc, true)
  const firstPersistentStateDivergenceDuringIntentExecution = firstSemanticRecordDifference(ibb, ibc, 'persistentSemanticStateAfterIntent')
  const firstGroup0EndpointDivergence = compareEndpointDifference(ibb, ibc)
  const intentExecutionEffect = classifyIntentEffect(baselineIdsOrderEffect, candidateIdsOrderEffect, fixedOrderIdContentEffect)
  const overall = !preIntentEquivalent
    ? 'PRE_INTENT_EXECUTION_CONTAMINATED'
    : fixedOrderIdContentEffect
      ? 'INTENT_ORDER_AND_ID_COUPLED'
      : intentExecutionEffect === 'NONE'
        ? 'NO_RESIDUAL_DIVERGENCE'
        : 'INTENT_EXECUTION_ORDER_DIVERGENCE_ONLY'
  return {
    baselineDefault,
    candidateDefault,
    baselineProductionOrder: baselineIntentOrder,
    candidateProductionOrder: candidateIntentOrder,
    cells,
    comparisons: { fixedBaselineOrder, fixedCandidateOrder, baselineIdsOrderEffect, candidateIdsOrderEffect },
    preIntentEquivalent,
    firstProductionIntentOrderDivergence: compareIntentOrder(baselineIntentOrder, candidateIntentOrder),
    firstExecutionDivergence,
    firstActedResultDivergence,
    firstActionDeltaDivergence,
    firstLedgerDivergence,
    firstFallbackRequestDivergence,
    firstFallbackRequestPrefixDivergence,
    firstPersistentStateDivergenceDuringIntentExecution,
    firstGroup0EndpointDivergence,
    fixedOrderIdContentEffect,
    intentExecutionEffect,
    overall,
  }
}

function runGroup0Reference(source: ReturnType<typeof prepareActorTurn>, probe: OrderingProbeResult, baselineOrder: string[][]): ActorTurnTrace & { intentExecution: ActorTurnIntentTrace } {
  const trace = runTracedActorTurn(source, {
    actorOrder: { groups: baselineOrder },
    stopAfterGroupOrdinal: 0,
  }) as ActorTurnTrace & { intentExecution: ActorTurnIntentTrace }
  if (!trace.intentExecution) throw new Error('INTENT_TRACE_MISSING')
  return trace
}

function runCell(
  scenario: CombatBalanceScenario,
  seed: number,
  probe: OrderingProbeResult,
  label: IntentOrderCell['label'],
  baselineOrder: string[][],
  intentOrder: SemanticIntentKey[],
): IntentOrderCell {
  const source = prepareActorTurn(scenario, seed, probe)
  const options: ActorTurnReplayOverrides = {
    actorOrder: { groups: baselineOrder },
    intentExecutionOrder: { groups: [intentOrder] },
    stopAfterGroupOrdinal: 0,
  }
  const trace = runTracedActorTurn(source, options) as ActorTurnTrace & { intentExecution: ActorTurnIntentTrace }
  if (!trace.intentExecution) throw new Error('INTENT_TRACE_MISSING')
  return { label, ids: probe.transform === 'baseline' ? 'baseline' : 'candidate', intentOrder: label.endsWith('B') ? 'baseline' : 'candidate', trace }
}

function requireIntentOrder(trace: ActorTurnTrace & { intentExecution: ActorTurnIntentTrace }): SemanticIntentKey[] {
  const order = trace.intentExecution.groups[0]?.executionOrder
  if (!order) throw new Error('INTENT_GROUP_ZERO_MISSING')
  return structuredClone(order)
}

function comparePreIntent(left: IntentGroupTrace | undefined, right: IntentGroupTrace | undefined): boolean {
  if (!left || !right) return false
  return canonicalSerialize(left.planning.preIntentPersistentState) === canonicalSerialize(right.planning.preIntentPersistentState) &&
    canonicalSerialize(left.planning.semanticMeleeSectors) === canonicalSerialize(right.planning.semanticMeleeSectors) &&
    canonicalSerialize(left.planning.semanticActorTraversal) === canonicalSerialize(right.planning.semanticActorTraversal) &&
    canonicalSerialize(left.planning.preIntentMovementRequests) === canonicalSerialize(right.planning.preIntentMovementRequests) &&
    canonicalSerialize(left.planning.semanticIntentMultiset) === canonicalSerialize(right.planning.semanticIntentMultiset) &&
    canonicalSerialize(left.planning.semanticGroupLedgerFrameGuard) === canonicalSerialize(right.planning.semanticGroupLedgerFrameGuard)
}

function compareIntentOrder(left: readonly SemanticIntentKey[], right: readonly SemanticIntentKey[]): DiagnosticRecord | null {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (canonicalSerialize(left[index]) !== canonicalSerialize(right[index])) return { executionOrdinal: index, baselineValue: left[index], candidateValue: right[index] }
  }
  return left.length === right.length ? null : { field: 'length', baselineValue: left.length, candidateValue: right.length }
}

function firstOrderDifference(left: IntentOrderCell, right: IntentOrderCell): DiagnosticRecord | null {
  const a = left.trace.intentExecution.groups[0]?.records ?? []
  const b = right.trace.intentExecution.groups[0]?.records ?? []
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (canonicalSerialize(a[index]!.intentKey) !== canonicalSerialize(b[index]!.intentKey)) return { executionOrdinal: index, baselineValue: a[index]!.intentKey, candidateValue: b[index]!.intentKey }
  }
  return null
}

function firstSemanticRecordDifference(left: IntentOrderCell, right: IntentOrderCell, field: 'acted' | 'normalizedActionDelta' | 'semanticLedgerDelta' | 'persistentSemanticStateAfterIntent'): DiagnosticRecord | null {
  const leftRecords = new Map(left.trace.intentExecution.groups[0]?.records.map(record => [intentKey(record.intentKey), record]))
  const rightRecords = new Map(right.trace.intentExecution.groups[0]?.records.map(record => [intentKey(record.intentKey), record]))
  for (const [key, a] of leftRecords) {
    const b = rightRecords.get(key)
    if (!b) return { field: `${field}.missing`, intentKey: a!.intentKey }
    if (canonicalSerialize(a![field]) !== canonicalSerialize(b[field])) return { field, intentKey: a!.intentKey, baselineValue: a![field], candidateValue: b[field] }
  }
  return null
}

function firstFallbackDifference(left: IntentOrderCell, right: IntentOrderCell, prefix: boolean): DiagnosticRecord | null {
  const a = left.trace.intentExecution.groups[0]?.records ?? []
  const b = right.trace.intentExecution.groups[0]?.records ?? []
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const leftValue = prefix ? a[index]!.fallbackMovementRequestPrefix : a[index]!.fallbackMovementRequest
    const rightValue = prefix ? b[index]!.fallbackMovementRequestPrefix : b[index]!.fallbackMovementRequest
    if (canonicalSerialize(leftValue) !== canonicalSerialize(rightValue)) return { executionOrdinal: index, baselineValue: leftValue, candidateValue: rightValue }
  }
  return null
}

function compareEndpointDifference(left: IntentOrderCell, right: IntentOrderCell): DiagnosticRecord | null {
  const a = left.trace.intentExecution.groups[0]?.groupEndpointBeforePhaseDrain
  const b = right.trace.intentExecution.groups[0]?.groupEndpointBeforePhaseDrain
  return canonicalSerialize(a) === canonicalSerialize(b) ? null : { field: 'groupEndpointBeforePhaseDrain', baselineValue: a, candidateValue: b }
}

function intentKey(key: SemanticIntentKey): string {
  return `${key.semanticActor}|${key.semanticTarget}|${key.kind}|${key.originalSequence}`
}

function classifyIntentEffect(left: IntentTracePairComparison, right: IntentTracePairComparison, fixedIdEffect: boolean): string {
  if (fixedIdEffect) return firstLocalEffect(left) ?? firstLocalEffect(right) ?? 'UNRESOLVED'
  const comparisons = [left, right]
  if (comparisons.some(item => String(item.firstDifference?.field ?? '').includes('.acted'))) return 'ACTED_RESULT'
  if (comparisons.some(item => String(item.firstDifference?.field ?? '').includes('semanticLedger'))) return 'LEDGER_SIDE_EFFECT'
  if (comparisons.some(item => String(item.firstDifference?.field ?? '').includes('normalizedAction'))) return 'ACTION_SIDE_EFFECT'
  if (comparisons.every(item => item.localEquivalent && item.groupEndpointEquivalent && item.fallbackMultisetEquivalent) && comparisons.some(item => !item.fallbackSequenceEquivalent)) return 'FALLBACK_SEQUENCE_ONLY'
  if (comparisons.every(item => item.localEquivalent && item.groupEndpointEquivalent && item.orderEquivalent)) return 'NONE'
  return 'UNRESOLVED'
}

function firstLocalEffect(comparison: IntentTraceComparison): string | null {
  const field = String(comparison.firstDifference?.field ?? '')
  if (field.includes('acted')) return 'ACTED_RESULT'
  if (field.includes('semanticLedger')) return 'LEDGER_SIDE_EFFECT'
  if (field.includes('normalizedAction')) return 'ACTION_SIDE_EFFECT'
  return null
}

export function loadPr12Endpoint(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult, label: 'BB' | 'CC'): Stage0Checkpoint {
  return captureMovementPipelineCell(scenario, seed, label, probe, 1).stage0
}

export function defaultActorTurnEquivalent(cell: ActorTurnCell): boolean {
  return cell.endpointEquivalentToProduction && cell.endpointEquivalentToPr12
}
