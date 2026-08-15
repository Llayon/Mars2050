import type { BattleAction } from '@/domains/combat/combat.actions'
import type { EcsInitiativeGroup } from '@/domains/combat/ecs/systems/initiative-system'
import type { Stage0Checkpoint } from './combat-movement-pipeline-types'

export type ActorTurnStage = 'before_actor' | 'after_targeting' | 'after_reservation' | 'after_group_commit'

export interface SemanticSector {
  semanticTarget: string
  occupiedMask: number
}

export interface ActorStateView {
  entityTargets: Record<string, unknown>
  targeting: Record<string, unknown>
}

export interface ActorTraceRecord {
  groupOrdinal: number
  speed: number
  processingOrdinal: number
  semanticActor: string
  productionExternalId: string
  before: ActorStateView & { meleeSectors: SemanticSector[] }
  targeting: ActorStateView & {
    semanticTarget: string | null
    meleeSectors: SemanticSector[]
  }
  reservation: {
    attempted: boolean
    succeeded: boolean | null
    semanticTarget: string | null
    slot: number | null
    waitingTarget: string | null
    meleeSectors: SemanticSector[]
    state: ActorStateView
  }
}

export interface InitiativeGroupTrace {
  groupOrdinal: number
  speed: number
  semanticMembers: string[]
  productionOrder: string[]
  processedOrder: string[]
  externalIdOrder: string[]
  actionIntents: Record<string, unknown>[]
  movementRequests: Record<string, unknown>[]
  actions: Record<string, unknown>[]
  endpoint: Stage0Checkpoint
}

export interface PreludeBoundary {
  label: string
  state: Stage0Checkpoint
  actions: Record<string, unknown>[]
  movementRequestCount: number
}

export interface ProcessingOrderDivergence {
  groupOrdinal: number
  speed: number
  processingOrdinal: number
  baselineSemanticActor: string
  candidateSemanticActor: string
  baselineExternalId: string
  candidateExternalId: string
}

export interface SemanticActorBehaviorDivergence {
  semanticActor: string
  baselineOrdinal: number
  candidateOrdinal: number
  field: string
  baselineValue: unknown
  candidateValue: unknown
  baselineBefore: ActorTraceRecord['before']
  candidateBefore: ActorTraceRecord['before']
}

export interface SectorPrefixDivergence {
  groupOrdinal: number
  speed: number
  processingOrdinal: number
  stage: 'before_actor' | 'after_targeting' | 'after_reservation'
  baselineSemanticActor: string
  candidateSemanticActor: string
  baselineValue: SemanticSector[]
  candidateValue: SemanticSector[]
}

export interface SharedOrderTraceComparison {
  equivalent: boolean
  firstDifference: {
    scope: 'prelude' | 'actor' | 'group' | 'endpoint'
    groupOrdinal?: number
    semanticActor?: string
    field: string
    baselineValue: unknown
    candidateValue: unknown
  } | null
}

export interface GroupEndpointDivergence {
  groupOrdinal: number
  speed: number
  field: string
  baselineValue: unknown
  candidateValue: unknown
}

export interface ActorTurnTrace {
  prelude: PreludeBoundary[]
  groups: InitiativeGroupTrace[]
  actors: ActorTraceRecord[]
  endpoint: Stage0Checkpoint
  normalizedActions: Record<string, unknown>[]
  movementRequests: Record<string, unknown>[]
  initiativeGroups: EcsInitiativeGroup[]
}

export interface ActorTurnCell {
  label: string
  ids: 'baseline' | 'candidate'
  order: 'baseline' | 'candidate'
  trace: ActorTurnTrace
  endpointEquivalentToProduction: boolean
  endpointEquivalentToPr12: boolean
}

export interface ActorTurnComparison {
  preActorStateEquivalent: boolean
  preludeEquivalent: boolean
  initiativeGroupMembershipEquivalent: boolean
  initiativeGroupStructureEquivalent: boolean
  productionOrder: ProcessingOrderDivergence | null
  sectorPrefix: SectorPrefixDivergence | null
  semanticActorBehavior: SemanticActorBehaviorDivergence | null
  targetingDivergence: SemanticActorBehaviorDivergence | null
  reservationDivergence: SemanticActorBehaviorDivergence | null
  groupEndpoint: GroupEndpointDivergence | null
  persistentDivergence: {
    semanticActor: string
    field: string
    baselineValue: unknown
    candidateValue: unknown
  } | null
}

export interface CounterfactualResult {
  cells: ActorTurnCell[]
  orderEffects: {
    baselineIds: boolean
    candidateIds: boolean
  }
  idContentEffects: {
    baselineOrder: boolean
    candidateOrder: boolean
  }
  traceComparisons: {
    baselineOrder: SharedOrderTraceComparison
    candidateOrder: SharedOrderTraceComparison
  }
  idContentTraceEffects: {
    baselineOrder: boolean
    candidateOrder: boolean
  }
  candidateBaselineOrderConverges: boolean
  candidateBaselineOrderTraceConverges: boolean
}

export interface ActorTurnDiagnosticResult {
  diagnostic: string
  version: number
  scenario: string
  primarySeed: number
  certifiedSeeds: number[]
  productionTrace: {
    baseline: ActorTurnTrace
    candidate: ActorTurnTrace
    comparison: ActorTurnComparison
  }
  counterfactual: CounterfactualResult
  fiveSeedRepeatability: Record<string, unknown>[]
  controls: Record<string, unknown>[]
  classification: string
}

export type ActionList = readonly BattleAction[]
