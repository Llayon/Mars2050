import type { BattleAction } from '@/domains/combat/combat.actions'
import type { BattleOutcome } from '@/domains/combat/combat.outcome'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { CombatPhaseId, RuntimePhaseContext } from '@/domains/combat/combat.phase'
import { getEcsPhaseOrder } from '@/domains/combat/ecs/combat-phase-scheduler'
import { drainV9FollowUps } from '@/domains/combat/ecs/v9-follow-up-queue'
import type { EcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { prepareMovementProbeWorld, type PreparedWorld } from './combat-movement-pipeline-advancement'
import {
  canonicalSerialize,
  captureSemanticEntityIdMapping,
  captureSemanticStateSnapshot,
  compareSemanticEntityIdMappings,
  type FirstSemanticStateDivergence,
  type SemanticEntityIdMapping,
} from './combat-semantic-state-diff'
import { appendBoundary, finalizeScan } from './combat-phase-boundary-report'
import type { OrderingProbeResult } from './combat-ordering-probes'
import type { Stage0Checkpoint } from './combat-movement-pipeline-types'

export type BoundaryStage = 'initial' | 'pre_action' | 'action' | 'post_action'
export type PhaseBoundaryClassification =
  | 'HARNESS_EQUIVALENCE_FAILED'
  | 'ENTITY_ID_MAPPING_CONTAMINATED'
  | 'INITIAL_STATE_CONTAMINATED'
  | 'PR11_CHECKPOINT_REPRODUCTION_FAILED'
  | 'TERMINAL_STATE_DIVERGENCE'
  | 'TARGET_TICK_UNREACHABLE'
  | 'PHASE_BOUNDARY_LOCALIZED'
  | 'UNRESOLVED'

export interface TerminalCheckResult {
  equivalent: boolean
  baselineOutcome: BattleOutcome | null
  candidateOutcome: BattleOutcome | null
}

export interface PhaseBoundaryRecord {
  ordinal: number
  tick: number
  stage: BoundaryStage
  phaseId: CombatPhaseId | null
  label: string
  baselineSemanticStateHash: string
  candidateSemanticStateHash: string
  equivalentToCandidate: boolean
  firstSemanticStateDivergence: FirstSemanticStateDivergence | null
  baselinePhaseActions: Record<string, unknown>[]
  candidatePhaseActions: Record<string, unknown>[]
  terminalCheck?: TerminalCheckResult
}

export interface BoundaryReference {
  ordinal: number
  tick: number
  stage: BoundaryStage
  phaseId: CombatPhaseId | null
  label: string
}

export interface FirstDivergentBoundary {
  previous: BoundaryReference | null
  current: BoundaryReference
  firstSemanticStateDivergence: FirstSemanticStateDivergence | null
}

export interface PhaseBoundaryScanResult {
  classification: PhaseBoundaryClassification
  initialMappingEquivalent: boolean
  baselineInitialMapping: SemanticEntityIdMapping[]
  candidateInitialMapping: SemanticEntityIdMapping[]
  boundaries: PhaseBoundaryRecord[]
  firstDivergentBoundary: FirstDivergentBoundary | null
  baselineEndpoint: Stage0Checkpoint | null
  candidateEndpoint: Stage0Checkpoint | null
  terminalCheck: TerminalCheckResult | null
}

interface ScanWorld {
  prepared: PreparedWorld
  runtime: EcsCombatRuntime
  probe: OrderingProbeResult
  context: RuntimePhaseContext | null
}

const EMPTY_GLOBALS: NonNullable<RuntimePhaseContext['activeGlobals']> = []

export function scanPreTargetPhaseBoundaries(
  scenario: CombatBalanceScenario,
  seed: number,
  baselineProbe: OrderingProbeResult,
  candidateProbe: OrderingProbeResult,
): PhaseBoundaryScanResult {
  const baseline = createScanWorld(scenario, seed, baselineProbe)
  const candidate = createScanWorld(scenario, seed, candidateProbe)
  const baselineInitialMapping = captureSemanticEntityIdMapping(baseline.prepared.runtime, baseline.probe)
  const candidateInitialMapping = captureSemanticEntityIdMapping(candidate.prepared.runtime, candidate.probe)
  const initialMappingEquivalent = compareSemanticEntityIdMappings(baselineInitialMapping, candidateInitialMapping)
  const boundaries: PhaseBoundaryRecord[] = []
  let terminalCheck: TerminalCheckResult | null = null

  if (!initialMappingEquivalent) return {
    classification: 'ENTITY_ID_MAPPING_CONTAMINATED', initialMappingEquivalent,
    baselineInitialMapping, candidateInitialMapping, boundaries,
    firstDivergentBoundary: null, baselineEndpoint: null, candidateEndpoint: null, terminalCheck,
  }

  startTick(baseline, 0)
  startTick(candidate, 0)
  appendBoundary(boundaries, baseline, candidate, 'tick0.initial', 'initial', null)
  if (!boundaries[0]!.equivalentToCandidate) return finalizeScan(
    'INITIAL_STATE_CONTAMINATED', boundaries, baselineInitialMapping, candidateInitialMapping, terminalCheck,
  )

  scanStage(boundaries, baseline, candidate, 'pre_action')
  terminalCheck = checkTerminal(baseline, candidate)
  appendBoundary(boundaries, baseline, candidate, 'tick0.before_actor_turn', 'pre_action', null, terminalCheck)
  if (!terminalCheck.equivalent) return finalizeScan(
    'TERMINAL_STATE_DIVERGENCE', boundaries, baselineInitialMapping, candidateInitialMapping, terminalCheck,
  )
  if (terminalCheck.baselineOutcome || terminalCheck.candidateOutcome) return finalizeScan(
    'TARGET_TICK_UNREACHABLE', boundaries, baselineInitialMapping, candidateInitialMapping, terminalCheck,
  )

  scanStage(boundaries, baseline, candidate, 'action')
  scanStage(boundaries, baseline, candidate, 'post_action')

  startTick(baseline, 1)
  startTick(candidate, 1)
  appendBoundary(boundaries, baseline, candidate, 'tick1.initial', 'initial', null)
  scanStage(boundaries, baseline, candidate, 'pre_action')
  terminalCheck = checkTerminal(baseline, candidate)
  appendBoundary(boundaries, baseline, candidate, 'tick1.before_actor_turn', 'pre_action', null, terminalCheck)
  if (!terminalCheck.equivalent) return finalizeScan(
    'TERMINAL_STATE_DIVERGENCE', boundaries, baselineInitialMapping, candidateInitialMapping, terminalCheck,
  )
  if (terminalCheck.baselineOutcome || terminalCheck.candidateOutcome) return finalizeScan(
    'TARGET_TICK_UNREACHABLE', boundaries, baselineInitialMapping, candidateInitialMapping, terminalCheck,
  )
  scanStage(boundaries, baseline, candidate, 'action')

  const endpointRecord = boundaries.find(boundary => boundary.label === 'tick1.action.after.actor_turn')
  const baselineEndpoint = endpointRecord ? captureSemanticStateSnapshot(baseline.prepared.runtime, baseline.probe) : null
  const candidateEndpoint = endpointRecord ? captureSemanticStateSnapshot(candidate.prepared.runtime, candidate.probe) : null
  const result = finalizeScan('UNRESOLVED', boundaries, baselineInitialMapping, candidateInitialMapping, terminalCheck, baselineEndpoint, candidateEndpoint)
  if (result.firstDivergentBoundary) result.classification = 'PHASE_BOUNDARY_LOCALIZED'
  return result
}

function scanStage(
  boundaries: PhaseBoundaryRecord[],
  baseline: ScanWorld,
  candidate: ScanWorld,
  stage: Exclude<BoundaryStage, 'initial'>,
): void {
  const context = baseline.context
  if (!context || !candidate.context) throw new Error('PHASE_SCAN_CONTEXT_MISSING')
  for (const phaseId of getEcsPhaseOrder(stage)) {
    const baselineActionStart = context.actions.length
    const candidateActionStart = candidate.context.actions.length
    baseline.prepared.runtime.runPhase(phaseId, context)
    drainV9FollowUps(baseline.prepared.runtime.world, context)
    candidate.prepared.runtime.runPhase(phaseId, candidate.context)
    drainV9FollowUps(candidate.prepared.runtime.world, candidate.context)
    appendBoundary(
      boundaries,
      baseline,
      candidate,
      `tick${context.tick}.${stage}.after.${phaseId}`,
      stage,
      phaseId,
      undefined,
      context.actions.slice(baselineActionStart),
      candidate.context.actions.slice(candidateActionStart),
    )
  }
}

function createScanWorld(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult): ScanWorld {
  const prepared = prepareMovementProbeWorld(scenario, seed, probe)
  return { prepared, runtime: prepared.runtime, probe, context: null }
}

function startTick(world: ScanWorld, tick: number): void {
  const actions: BattleAction[] = []
  world.prepared.runtime.world.resources.require('clock').tick = tick
  world.prepared.runtime.world.resources.set('actions', actions)
  world.context = { tick, actions, rng: world.prepared.rng, activeGlobals: EMPTY_GLOBALS }
}

function checkTerminal(baseline: ScanWorld, candidate: ScanWorld): TerminalCheckResult {
  const baselineOutcome = baseline.prepared.runtime.getTerminalOutcome()
  const candidateOutcome = candidate.prepared.runtime.getTerminalOutcome()
  return {
    equivalent: canonicalSerialize(baselineOutcome) === canonicalSerialize(candidateOutcome),
    baselineOutcome,
    candidateOutcome,
  }
}

