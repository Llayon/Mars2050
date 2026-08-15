import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { drainV9FollowUps } from '@/domains/combat/ecs/v9-follow-up-queue'
import { advanceToPreActorTurnCheckpoint } from './combat-movement-pipeline-advancement'
import {
  canonicalSerialize,
  captureSemanticEntityIdMapping,
  captureSemanticStateSnapshot,
  compareSemanticEntityIdMappings,
  compareSemanticStates,
} from './combat-semantic-state-diff'
import type { OrderingProbeResult } from './combat-ordering-probes'
import { replayActorTurn, type ActorTurnOrderOverride } from './combat-actor-turn-reservation-execution'
import { compareSharedOrderTraces } from './combat-actor-turn-reservation-comparison'
export { compareActorTurnCells } from './combat-actor-turn-reservation-comparison'
import type {
  ActorTurnCell,
  ActorTurnComparison,
  ActorTurnTrace,
  CounterfactualResult,
} from './combat-actor-turn-reservation-types'

export interface ActorTurnPrepared {
  prepared: ReturnType<typeof advanceToPreActorTurnCheckpoint>
  probe: OrderingProbeResult
  preActorState: ReturnType<typeof captureSemanticStateSnapshot>
  mapping: ReturnType<typeof captureSemanticEntityIdMapping>
}

export interface ProductionActorTurnResult {
  endpoint: ReturnType<typeof captureSemanticStateSnapshot>
  actions: Record<string, unknown>[]
  movementRequests: Record<string, unknown>[]
}

export interface ActorTurnPairResult {
  baseline: ActorTurnCell
  candidate: ActorTurnCell
  comparison: ActorTurnComparison
  mappingEquivalent: boolean
  preActorStateEquivalent: boolean
}

export function prepareActorTurn(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult): ActorTurnPrepared {
  const prepared = advanceToPreActorTurnCheckpoint(scenario, seed, probe, 1)
  return {
    prepared,
    probe,
    preActorState: captureSemanticStateSnapshot(prepared.runtime, probe),
    mapping: captureSemanticEntityIdMapping(prepared.runtime, probe),
  }
}

export function runProductionActorTurn(source: ActorTurnPrepared): ProductionActorTurnResult {
  const { prepared } = source
  prepared.runtime.runPhase('actor_turn', prepared.context)
  drainV9FollowUps(prepared.runtime.world, prepared.context)
  return {
    endpoint: captureSemanticStateSnapshot(prepared.runtime, source.probe),
    actions: prepared.actions.map(action => ({ ...action })),
    movementRequests: describeMovementRequests(prepared.runtime.world.resources.require('movementRequests'), prepared.runtime.world, source.probe),
  }
}

export function runTracedActorTurn(source: ActorTurnPrepared, orderOverride?: ActorTurnOrderOverride): ActorTurnTrace {
  const trace = replayActorTurn(source.prepared, source.probe, orderOverride)
  drainV9FollowUps(source.prepared.runtime.world, source.prepared.context)
  return { ...trace, endpoint: captureSemanticStateSnapshot(source.prepared.runtime, source.probe) }
}

export function runDefaultActorTurnCell(
  scenario: CombatBalanceScenario,
  seed: number,
  probe: OrderingProbeResult,
  label: string,
  pr12Endpoint: ReturnType<typeof captureSemanticStateSnapshot>,
): ActorTurnCell {
  const productionSource = prepareActorTurn(scenario, seed, probe)
  const production = runProductionActorTurn(productionSource)
  const tracedSource = prepareActorTurn(scenario, seed, probe)
  const trace = runTracedActorTurn(tracedSource)
  const endpointEquivalentToProduction = compareSemanticStates(production.endpoint, trace.endpoint).equivalent &&
    canonicalSerialize(production.actions) === canonicalSerialize(trace.normalizedActions) &&
    canonicalSerialize(production.movementRequests) === canonicalSerialize(trace.movementRequests)
  return {
    label,
    ids: probe.transform === 'baseline' ? 'baseline' : 'candidate',
    order: probe.transform === 'baseline' ? 'baseline' : 'candidate',
    trace,
    endpointEquivalentToProduction,
    endpointEquivalentToPr12: compareSemanticStates(production.endpoint, pr12Endpoint).equivalent,
  }
}

export function runCounterfactual(
  scenario: CombatBalanceScenario,
  seed: number,
  baselineProbe: OrderingProbeResult,
  candidateProbe: OrderingProbeResult,
  baselineProduction: ActorTurnTrace,
  candidateProduction: ActorTurnTrace,
): CounterfactualResult {
  const cells = [
    runCounterfactualCell(scenario, seed, baselineProbe, 'BB', baselineProduction),
    runCounterfactualCell(scenario, seed, baselineProbe, 'BC', candidateProduction),
    runCounterfactualCell(scenario, seed, candidateProbe, 'CB', baselineProduction),
    runCounterfactualCell(scenario, seed, candidateProbe, 'CC', candidateProduction),
  ]
  const bb = cells[0]!, bc = cells[1]!, cb = cells[2]!, cc = cells[3]!
  const endpointEqual = (left: ActorTurnCell, right: ActorTurnCell) => compareSemanticStates(left.trace.endpoint, right.trace.endpoint).equivalent
  const baselineOrderTrace = compareSharedOrderTraces(bb.trace, cb.trace)
  const candidateOrderTrace = compareSharedOrderTraces(bc.trace, cc.trace)
  return {
    cells,
    orderEffects: { baselineIds: !endpointEqual(bb, bc), candidateIds: !endpointEqual(cb, cc) },
    idContentEffects: { baselineOrder: !endpointEqual(bb, cb), candidateOrder: !endpointEqual(bc, cc) },
    traceComparisons: { baselineOrder: baselineOrderTrace, candidateOrder: candidateOrderTrace },
    idContentTraceEffects: { baselineOrder: !baselineOrderTrace.equivalent, candidateOrder: !candidateOrderTrace.equivalent },
    candidateBaselineOrderConverges: endpointEqual(bb, cb),
    candidateBaselineOrderTraceConverges: baselineOrderTrace.equivalent,
  }
}

export function assertActorTurnMapping(baseline: ActorTurnPrepared, candidate: ActorTurnPrepared): void {
  if (!compareSemanticEntityIdMappings(baseline.mapping, candidate.mapping)) throw new Error('ACTOR_TURN_ENTITY_ID_MAPPING_CONTAMINATED')
  if (!compareSemanticStates(baseline.preActorState, candidate.preActorState).equivalent) throw new Error('PR12_PRE_ACTOR_CHECKPOINT_REPRODUCTION_FAILED')
}

function runCounterfactualCell(scenario: CombatBalanceScenario, seed: number, probe: OrderingProbeResult, label: string, orderSource: ActorTurnTrace): ActorTurnCell {
  const source = prepareActorTurn(scenario, seed, probe)
  const groupOrders = orderSource.groups.map(group => group.productionOrder)
  const trace = runTracedActorTurn(source, { groups: groupOrders })
  return { label, ids: probe.transform === 'baseline' ? 'baseline' : 'candidate', order: label.endsWith('B') ? 'baseline' : 'candidate', trace, endpointEquivalentToProduction: false, endpointEquivalentToPr12: false }
}

function describeMovementRequests(requests: readonly { kind: string; entityId: number; targetId?: number; targetX?: number; targetY?: number; initiativeIndex: number }[], world: Parameters<typeof captureSemanticStateSnapshot>[0]['world'], probe: OrderingProbeResult): Record<string, unknown>[] {
  return requests.map(request => request.kind === 'turn'
    ? { kind: request.kind, semanticActor: semanticId(world, request.entityId, probe), targetX: request.targetX, targetY: request.targetY, initiativeIndex: request.initiativeIndex }
    : { kind: request.kind, semanticActor: semanticId(world, request.entityId, probe), semanticTarget: semanticId(world, request.targetId!, probe), initiativeIndex: request.initiativeIndex })
}

function semanticId(world: Parameters<typeof captureSemanticStateSnapshot>[0]['world'], entityId: number, probe: OrderingProbeResult): string {
  const externalId = world.stores.identity.require(entityId).id
  const identity = probe.semanticByExternalId.get(externalId)
  if (!identity) throw new Error(`MISSING_SEMANTIC_IDENTITY:${externalId}`)
  return `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}`
}
