import type { BattleAction } from '@/domains/combat/combat.actions'
import type { EcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { normalizeCommittedActions } from './combat-movement-pipeline-diagnostics'
import {
  captureSemanticStateSnapshot,
  compareSemanticEntityIdMappings,
  compareSemanticStates,
} from './combat-semantic-state-diff'
import type { OrderingProbeResult } from './combat-ordering-probes'
import type { Stage0Checkpoint } from './combat-movement-pipeline-types'
import type {
  BoundaryReference,
  BoundaryStage,
  FirstDivergentBoundary,
  PhaseBoundaryClassification,
  PhaseBoundaryRecord,
  PhaseBoundaryScanResult,
  TerminalCheckResult,
} from './combat-phase-boundary-probes'
import type { SemanticEntityIdMapping } from './combat-semantic-state-diff'

export interface BoundaryCaptureWorld {
  runtime: EcsCombatRuntime
  probe: OrderingProbeResult
}

export function appendBoundary(
  boundaries: PhaseBoundaryRecord[],
  baseline: BoundaryCaptureWorld,
  candidate: BoundaryCaptureWorld,
  label: string,
  stage: BoundaryStage,
  phaseId: PhaseBoundaryRecord['phaseId'],
  terminalCheck?: TerminalCheckResult,
  baselineActions: readonly BattleAction[] = [],
  candidateActions: readonly BattleAction[] = [],
): void {
  const baselineSnapshot = captureSemanticStateSnapshot(baseline.runtime, baseline.probe)
  const candidateSnapshot = captureSemanticStateSnapshot(candidate.runtime, candidate.probe)
  const comparison = compareSemanticStates(baselineSnapshot, candidateSnapshot)
  boundaries.push({
    ordinal: boundaries.length, tick: baselineSnapshot.clock.tick, stage, phaseId, label,
    baselineSemanticStateHash: comparison.baselineHash, candidateSemanticStateHash: comparison.candidateHash,
    equivalentToCandidate: comparison.equivalent,
    firstSemanticStateDivergence: comparison.firstSemanticStateDivergence,
    baselinePhaseActions: normalizeCommittedActions(baselineActions, baseline.probe),
    candidatePhaseActions: normalizeCommittedActions(candidateActions, candidate.probe),
    ...(terminalCheck ? { terminalCheck } : {}),
  })
}

export function finalizeScan(
  classification: PhaseBoundaryClassification,
  boundaries: PhaseBoundaryRecord[],
  baselineInitialMapping: SemanticEntityIdMapping[],
  candidateInitialMapping: SemanticEntityIdMapping[],
  terminalCheck: TerminalCheckResult | null,
  baselineEndpoint: Stage0Checkpoint | null = null,
  candidateEndpoint: Stage0Checkpoint | null = null,
): PhaseBoundaryScanResult {
  return {
    classification,
    initialMappingEquivalent: compareSemanticEntityIdMappings(baselineInitialMapping, candidateInitialMapping),
    baselineInitialMapping, candidateInitialMapping, boundaries,
    firstDivergentBoundary: findFirstDivergentBoundary(boundaries),
    baselineEndpoint, candidateEndpoint, terminalCheck,
  }
}

function findFirstDivergentBoundary(boundaries: readonly PhaseBoundaryRecord[]): FirstDivergentBoundary | null {
  const index = boundaries.findIndex(boundary => !boundary.equivalentToCandidate)
  if (index < 0) return null
  const current = boundaries[index]!
  return {
    previous: index === 0 ? null : toBoundaryReference(boundaries[index - 1]!),
    current: toBoundaryReference(current),
    firstSemanticStateDivergence: current.firstSemanticStateDivergence,
  }
}

function toBoundaryReference(boundary: PhaseBoundaryRecord): BoundaryReference {
  return { ordinal: boundary.ordinal, tick: boundary.tick, stage: boundary.stage, phaseId: boundary.phaseId, label: boundary.label }
}
