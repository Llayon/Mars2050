import type { DiagnosticRecord, SemanticIntentKey } from './combat-actor-turn-intent-order-types'

export type RequestFactor = 'baseline' | 'candidate'
export type RequestOrderEffect = 'NONE' | 'PLANNING_ACTION_ORDER' | 'MOVEMENT_STATE' | 'MOVEMENT_INTENT' | 'UNRESOLVED'
export type InitiativeAssignmentEffect = 'NONE' | 'MOVE_REPLAY_ORDER_ONLY' | 'STATE_EFFECT' | 'UNRESOLVED'

export interface SemanticMovementRequest {
  kind: string
  semanticActor: string
  semanticTarget: string | null
  targetX?: number
  targetY?: number
  initiativeIndex: number
}

export interface BatchMovementCell {
  label: string
  requestOrder: RequestFactor
  assignment: RequestFactor
  actorTurnEndpoint: unknown
  actorTurnActions: DiagnosticRecord[]
  requests: SemanticMovementRequest[]
  planningActions: DiagnosticRecord[]
  committedMoveActions: DiagnosticRecord[]
  allActions: DiagnosticRecord[]
  endpoint: unknown
  transforms: DiagnosticRecord[]
  collisionProfile: DiagnosticRecord
  dirtyEntities: string[]
  partitionSupported: boolean
}

export interface BatchPairComparison {
  requestOrderEquivalent: boolean
  requestContentEquivalent: boolean
  initiativeAssignmentEquivalent: boolean
  planningActionMultisetEquivalent: boolean
  planningActionSequenceEquivalent: boolean
  moveActionMultisetEquivalent: boolean
  moveActionSequenceEquivalent: boolean
  stateEquivalent: boolean
  transformsEquivalent: boolean
  collisionEquivalent: boolean
  dirtyEntitiesEquivalent: boolean
  requestOrderEffect: RequestOrderEffect
  initiativeAssignmentEffect: InitiativeAssignmentEffect
}

export interface Batch2x2Experiment {
  cells: BatchMovementCell[]
  comparisons: {
    fixedBaselineAssignment: BatchPairComparison
    fixedCandidateAssignment: BatchPairComparison
    fixedBaselineOrder: BatchPairComparison
    fixedCandidateOrder: BatchPairComparison
  }
  reference: {
    actorTurnStateEquivalent: boolean
    actorTurnActionsEquivalent: boolean
    requestContentEquivalent: boolean
    requestSequenceDifferent: boolean
    initiativeAssignmentDifferent: boolean
    baselineIntentOrder: SemanticIntentKey[]
    candidateIntentOrder: SemanticIntentKey[]
  }
}
