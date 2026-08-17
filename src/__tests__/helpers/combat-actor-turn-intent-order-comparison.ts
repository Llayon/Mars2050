import { canonicalSerialize, compareSemanticStates } from './combat-semantic-state-diff'
import type { ActorTurnIntentTrace, DiagnosticRecord, IntentGroupTrace, IntentTraceComparison, SemanticIntentKey } from './combat-actor-turn-intent-order-types'

export interface IntentTracePairComparison extends IntentTraceComparison {
  localEquivalent: boolean
  groupEndpointEquivalent: boolean
  fallbackMultisetEquivalent: boolean
  fallbackSequenceEquivalent: boolean
  orderEquivalent: boolean
}

export function compareFixedOrderTraces(left: ActorTurnIntentTrace, right: ActorTurnIntentTrace): IntentTracePairComparison {
  const leftGroup = left.groups[0]
  const rightGroup = right.groups[0]
  if (!leftGroup || !rightGroup) return emptyComparison('missing group')
  const firstDifference = comparePlanning(leftGroup, rightGroup) ?? compareRecordsAligned(leftGroup, rightGroup)
  const localEquivalent = firstDifference === null
  const groupEndpointEquivalent = compareSemanticEndpoint(leftGroup.groupEndpointBeforePhaseDrain, rightGroup.groupEndpointBeforePhaseDrain)
  const fallbackMultisetEquivalent = canonicalSerialize(sortRecords(leftGroup.fallbackMovementRequests.map(stripInitiative))) === canonicalSerialize(sortRecords(rightGroup.fallbackMovementRequests.map(stripInitiative)))
  const fallbackSequenceEquivalent = canonicalSerialize(leftGroup.fallbackMovementRequests) === canonicalSerialize(rightGroup.fallbackMovementRequests)
  const equivalent = localEquivalent && groupEndpointEquivalent && fallbackMultisetEquivalent && fallbackSequenceEquivalent
  return {
    equivalent,
    firstDifference,
    localEquivalent,
    groupEndpointEquivalent,
    fallbackMultisetEquivalent,
    fallbackSequenceEquivalent,
    orderEquivalent: canonicalSerialize(leftGroup.executionOrder) === canonicalSerialize(rightGroup.executionOrder),
  }
}

export function compareOrderEffectTraces(left: ActorTurnIntentTrace, right: ActorTurnIntentTrace): IntentTracePairComparison {
  const leftGroup = left.groups[0]
  const rightGroup = right.groups[0]
  if (!leftGroup || !rightGroup) return emptyComparison('missing group')
  const firstDifference = compareLocalRecords(leftGroup, rightGroup)
  const localEquivalent = firstDifference === null
  const groupEndpointEquivalent = compareSemanticEndpoint(leftGroup.groupEndpointBeforePhaseDrain, rightGroup.groupEndpointBeforePhaseDrain)
  const fallbackMultisetEquivalent = canonicalSerialize(sortRecords(leftGroup.fallbackMovementRequests.map(stripInitiative))) === canonicalSerialize(sortRecords(rightGroup.fallbackMovementRequests.map(stripInitiative)))
  const fallbackSequenceEquivalent = canonicalSerialize(leftGroup.fallbackMovementRequests) === canonicalSerialize(rightGroup.fallbackMovementRequests)
  const orderEquivalent = canonicalSerialize(leftGroup.executionOrder) === canonicalSerialize(rightGroup.executionOrder)
  return {
    equivalent: localEquivalent && groupEndpointEquivalent && fallbackMultisetEquivalent && fallbackSequenceEquivalent && orderEquivalent,
    firstDifference,
    localEquivalent,
    groupEndpointEquivalent,
    fallbackMultisetEquivalent,
    fallbackSequenceEquivalent,
    orderEquivalent,
  }
}

export function compareIntentKeys(left: readonly SemanticIntentKey[], right: readonly SemanticIntentKey[]): boolean {
  return canonicalSerialize(left) === canonicalSerialize(right)
}

function comparePlanning(left: IntentGroupTrace, right: IntentGroupTrace): DiagnosticRecord | null {
  const fields: Array<[string, unknown, unknown]> = [
    ['semanticActorTraversal', left.planning.semanticActorTraversal, right.planning.semanticActorTraversal],
    ['preIntentMovementRequests', left.planning.preIntentMovementRequests, right.planning.preIntentMovementRequests],
    ['semanticIntentMultiset', left.planning.semanticIntentMultiset, right.planning.semanticIntentMultiset],
    ['semanticMeleeSectors', left.planning.semanticMeleeSectors, right.planning.semanticMeleeSectors],
    ['semanticGroupLedgerFrameGuard', left.planning.semanticGroupLedgerFrameGuard, right.planning.semanticGroupLedgerFrameGuard],
  ]
  const difference = fields.find(([, a, b]) => canonicalSerialize(a) !== canonicalSerialize(b))
  return difference ? { field: `planning.${difference[0]}`, baselineValue: difference[1], candidateValue: difference[2] } : null
}

function compareRecordsAligned(left: IntentGroupTrace, right: IntentGroupTrace): DiagnosticRecord | null {
  if (left.records.length !== right.records.length) return { field: 'records.length', baselineValue: left.records.length, candidateValue: right.records.length }
  const rightByKey = new Map(right.records.map(record => [key(record.intentKey), record]))
  for (const record of left.records) {
    const other = rightByKey.get(key(record.intentKey))
    if (!other) return { field: 'records.missing', semanticIntent: record.intentKey }
    const fields: Array<[string, unknown, unknown]> = [
      ['acted', record.acted, other.acted],
      ['normalizedActionDelta', record.normalizedActionDelta, other.normalizedActionDelta],
      ['semanticLedgerDelta', record.semanticLedgerDelta, other.semanticLedgerDelta],
      ['fallbackMovementRequest', record.fallbackMovementRequest, other.fallbackMovementRequest],
      ['persistentSemanticStateAfterIntent', record.persistentSemanticStateAfterIntent, other.persistentSemanticStateAfterIntent],
    ]
    const difference = fields.find(([, a, b]) => canonicalSerialize(a) !== canonicalSerialize(b))
    if (difference) return { field: `intent.${difference[0]}`, semanticIntent: record.intentKey, baselineValue: difference[1], candidateValue: difference[2] }
  }
  return null
}

function compareLocalRecords(left: IntentGroupTrace, right: IntentGroupTrace): DiagnosticRecord | null {
  if (left.records.length !== right.records.length) return { field: 'records.length', baselineValue: left.records.length, candidateValue: right.records.length }
  const rightByKey = new Map(right.records.map(record => [key(record.intentKey), record]))
  for (const a of left.records) {
    const b = rightByKey.get(key(a.intentKey))
    if (!b) return { field: 'semanticIntent.missing', semanticIntent: a.intentKey }
    const fields: Array<[string, unknown, unknown]> = [
      ['acted', a.acted, b.acted],
      ['normalizedActionDelta', a.normalizedActionDelta, b.normalizedActionDelta],
      ['semanticLedgerDelta', a.semanticLedgerDelta, b.semanticLedgerDelta],
      ['fallbackMovementRequest', stripInitiative(a.fallbackMovementRequest), stripInitiative(b.fallbackMovementRequest)],
    ]
    const difference = fields.find(([, x, y]) => canonicalSerialize(x) !== canonicalSerialize(y))
    if (difference) return { field: `execution[${a.executionOrdinal}].${difference[0]}`, baselineValue: difference[1], candidateValue: difference[2] }
  }
  return null
}

function compareSemanticEndpoint(left: unknown, right: unknown): boolean {
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return canonicalSerialize(left) === canonicalSerialize(right)
  return compareSemanticStates(left as never, right as never).equivalent
}

function stripInitiative(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = { ...(value as DiagnosticRecord) }
  delete record.initiativeIndex
  return record
}

function sortRecords(values: readonly unknown[]): unknown[] {
  return [...values].sort((left, right) => canonicalSerialize(left).localeCompare(canonicalSerialize(right)))
}

function key(intent: SemanticIntentKey): string {
  return `${intent.semanticActor}|${intent.semanticTarget}|${intent.kind}|${intent.originalSequence}`
}

function emptyComparison(field: string): IntentTracePairComparison {
  return { equivalent: false, firstDifference: { field }, localEquivalent: false, groupEndpointEquivalent: false, fallbackMultisetEquivalent: false, fallbackSequenceEquivalent: false, orderEquivalent: false }
}
