import type { EcsActionKind } from '@/domains/combat/combat.action-intent'

export type DiagnosticRecord = Record<string, unknown>

export interface SemanticIntentKey {
  semanticActor: string
  semanticTarget: string
  kind: EcsActionKind
  originalSequence: number
}

export interface ActorTurnOrderOverride {
  readonly groups: readonly (readonly string[])[]
}

export interface ActorTurnIntentOrderOverride {
  readonly groups: readonly (readonly SemanticIntentKey[])[]
}

export interface ActorTurnInstrumentation {
  readonly onPlanning?: (checkpoint: IntentPlanningCheckpoint) => void
  readonly onIntent?: (record: IntentExecutionRecord) => void
  readonly onGroup?: (record: IntentGroupTrace) => void
}

export interface ActorTurnReplayOverrides {
  readonly actorOrder?: ActorTurnOrderOverride
  readonly intentExecutionOrder?: ActorTurnIntentOrderOverride
  readonly stopAfterGroupOrdinal?: number
  readonly instrumentation?: ActorTurnInstrumentation
}

export interface IntentPlanningCheckpoint {
  groupOrdinal: number
  speed: number
  semanticActorTraversal: string[]
  preIntentPersistentState: unknown
  semanticMeleeSectors: DiagnosticRecord[]
  preIntentMovementRequests: DiagnosticRecord[]
  unsortedIntents: SemanticIntentKey[]
  productionSortedIntents: SemanticIntentKey[]
  semanticIntentMultiset: SemanticIntentKey[]
  semanticGroupLedgerFrameGuard: unknown
}

export interface DynamicSemanticLedgerSnapshot {
  claims: DiagnosticRecord[]
  damage: DiagnosticRecord[]
  healing: DiagnosticRecord[]
  forcedDeaths: DiagnosticRecord[]
  statuses: DiagnosticRecord[]
  marks: DiagnosticRecord[]
  defenseGrants: DiagnosticRecord[]
  resolvedDamageTaken: DiagnosticRecord[]
  barrierExpirations: string[]
  barrierBreaks: string[]
}

export interface IntentExecutionRecord {
  groupOrdinal: number
  executionOrdinal: number
  intentKey: SemanticIntentKey
  rawActorExternalId: string
  rawTargetExternalId: string
  acted: boolean
  periodicSpawnerActionDelta: DiagnosticRecord[]
  actionSystemActionDelta: DiagnosticRecord[]
  normalizedActionDelta: DiagnosticRecord[]
  semanticLedgerBefore: DynamicSemanticLedgerSnapshot
  semanticLedgerAfter: DynamicSemanticLedgerSnapshot
  semanticLedgerDelta: unknown
  fallbackMovementRequest: DiagnosticRecord | null
  fallbackMovementRequestPrefix: DiagnosticRecord[]
  persistentSemanticStateAfterIntent: unknown
}

export interface IntentGroupTrace {
  groupOrdinal: number
  speed: number
  planning: IntentPlanningCheckpoint
  executionOrder: SemanticIntentKey[]
  records: IntentExecutionRecord[]
  preIntentMovementRequests: DiagnosticRecord[]
  fallbackMovementRequests: DiagnosticRecord[]
  combinedGroupMovementRequests: DiagnosticRecord[]
  groupEndpointBeforePhaseDrain: unknown
  endpoint: unknown
}

export interface ActorTurnIntentTrace {
  groups: IntentGroupTrace[]
  productionSortedIntentOrders: SemanticIntentKey[][]
  endpoint: unknown
  stoppedBeforePhaseDrain: boolean
}

export interface IntentTraceComparison {
  equivalent: boolean
  firstDifference: DiagnosticRecord | null
}
