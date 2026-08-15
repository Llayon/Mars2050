import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { drainV9FollowUps } from '@/domains/combat/ecs/v9-follow-up-queue'
import { advanceToPreActorTurnCheckpoint } from './combat-movement-pipeline-advancement'
import {
  canonicalSerialize,
  captureSemanticEntityIdMapping,
  captureSemanticStateSnapshot,
  compareSemanticEntityIdMappings,
  compareSemanticStates,
  type FirstSemanticStateDivergence,
} from './combat-semantic-state-diff'
import type { OrderingProbeResult } from './combat-ordering-probes'
import { replayActorTurn, type ActorTurnOrderOverride } from './combat-actor-turn-reservation-execution'
import type {
  ActorTurnCell,
  ActorTurnComparison,
  ActorTurnTrace,
  CounterfactualResult,
  GroupEndpointDivergence,
  ProcessingOrderDivergence,
  SemanticActorBehaviorDivergence,
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

export function compareActorTurnCells(baseline: ActorTurnCell, candidate: ActorTurnCell): ActorTurnComparison {
  const preludeEquivalent = baseline.trace.prelude.length === candidate.trace.prelude.length &&
    baseline.trace.prelude.every((item, index) => item.label === candidate.trace.prelude[index]?.label &&
      compareSemanticStates(item.state, candidate.trace.prelude[index]!.state).equivalent)
  const initiativeGroupMembershipEquivalent = baseline.trace.groups.length === candidate.trace.groups.length &&
    baseline.trace.groups.every((group, index) => JSON.stringify(group.semanticMembers) === JSON.stringify(candidate.trace.groups[index]?.semanticMembers))
  return {
    preActorStateEquivalent: compareSemanticStates(baseline.trace.prelude[0]!.state, candidate.trace.prelude[0]!.state).equivalent,
    preludeEquivalent,
    initiativeGroupMembershipEquivalent,
    productionOrder: firstProcessingOrderDivergence(baseline.trace, candidate.trace),
    semanticActorBehavior: firstSemanticActorBehaviorDivergence(baseline.trace, candidate.trace),
    targetingDivergence: firstSemanticActorBehaviorDivergence(baseline.trace, candidate.trace, ['targeting.semanticTarget']),
    reservationDivergence: firstSemanticActorBehaviorDivergence(baseline.trace, candidate.trace, ['reservation.succeeded', 'reservation.slot', 'reservation.meleeSectors', 'reservation.state']),
    groupEndpoint: firstGroupEndpointDivergence(baseline.trace, candidate.trace),
    persistentDivergence: firstPersistentDivergence(baseline.trace.endpoint, candidate.trace.endpoint),
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
  return {
    cells,
    orderEffects: { baselineIds: !endpointEqual(bb, bc), candidateIds: !endpointEqual(cb, cc) },
    idContentEffects: { baselineOrder: !endpointEqual(bb, cb), candidateOrder: !endpointEqual(bc, cc) },
    candidateBaselineOrderConverges: endpointEqual(bb, cb),
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

function firstProcessingOrderDivergence(baseline: ActorTurnTrace, candidate: ActorTurnTrace): ProcessingOrderDivergence | null {
  for (let group = 0; group < Math.min(baseline.groups.length, candidate.groups.length); group++) {
    const left = baseline.groups[group]!.productionOrder
    const right = candidate.groups[group]!.productionOrder
    for (let index = 0; index < Math.min(left.length, right.length); index++) {
      if (left[index] === right[index]) continue
      const baselineActor = baseline.actors.find(actor => actor.semanticActor === left[index])!
      const candidateActor = candidate.actors.find(actor => actor.semanticActor === right[index])!
      return {
        groupOrdinal: group, speed: baseline.groups[group]!.speed, processingOrdinal: baselineActor.processingOrdinal,
        baselineSemanticActor: left[index]!, candidateSemanticActor: right[index]!,
        baselineExternalId: baselineActor.productionExternalId, candidateExternalId: candidateActor.productionExternalId,
      }
    }
  }
  return null
}

function firstSemanticActorBehaviorDivergence(baseline: ActorTurnTrace, candidate: ActorTurnTrace, fields?: readonly string[]): SemanticActorBehaviorDivergence | null {
  const actors = [...new Set(baseline.actors.map(actor => actor.semanticActor))]
    .map(semanticActor => ({ semanticActor, baseline: baseline.actors.find(actor => actor.semanticActor === semanticActor), candidate: candidate.actors.find(actor => actor.semanticActor === semanticActor) }))
    .filter(item => item.baseline && item.candidate)
    .sort((left, right) => Math.min(left.baseline!.processingOrdinal, left.candidate!.processingOrdinal) - Math.min(right.baseline!.processingOrdinal, right.candidate!.processingOrdinal))
  for (const semanticActor of actors) {
    const left = semanticActor.baseline!
    const right = semanticActor.candidate!
    const pairs: Array<[string, unknown, unknown]> = [
      ['before.meleeSectors', left.before.meleeSectors, right.before.meleeSectors],
      ['targeting.semanticTarget', left.targeting.semanticTarget, right.targeting.semanticTarget],
      ['reservation.succeeded', left.reservation.succeeded, right.reservation.succeeded],
      ['reservation.slot', left.reservation.slot, right.reservation.slot],
      ['reservation.meleeSectors', left.reservation.meleeSectors, right.reservation.meleeSectors],
      ['reservation.state', left.reservation.state, right.reservation.state],
    ]
    const difference = pairs.filter(([field]) => !fields || fields.includes(field)).find(([, a, b]) => canonicalSerialize(a) !== canonicalSerialize(b))
    if (difference) return { semanticActor: semanticActor.semanticActor, baselineOrdinal: left.processingOrdinal, candidateOrdinal: right.processingOrdinal, field: difference[0], baselineValue: difference[1], candidateValue: difference[2], baselineBefore: left.before, candidateBefore: right.before }
  }
  return null
}

function firstGroupEndpointDivergence(baseline: ActorTurnTrace, candidate: ActorTurnTrace): GroupEndpointDivergence | null {
  for (let index = 0; index < Math.min(baseline.groups.length, candidate.groups.length); index++) {
    const comparison = compareSemanticStates(baseline.groups[index]!.endpoint, candidate.groups[index]!.endpoint)
    if (comparison.equivalent) continue
    const difference = comparison.firstSemanticStateDivergence
    return difference ? { groupOrdinal: index, speed: baseline.groups[index]!.speed, field: formatDifference(difference), baselineValue: difference.baselineValue, candidateValue: difference.candidateValue } : null
  }
  return null
}

function firstPersistentDivergence(baseline: ReturnType<typeof captureSemanticStateSnapshot>, candidate: ReturnType<typeof captureSemanticStateSnapshot>): ActorTurnComparison['persistentDivergence'] {
  const difference = compareSemanticStates(baseline, candidate).firstSemanticStateDivergence
  return difference ? { semanticActor: difference.semanticActor, field: `${difference.component}.${difference.fieldPath}`, baselineValue: difference.baselineValue, candidateValue: difference.candidateValue } : null
}

function formatDifference(difference: FirstSemanticStateDivergence): string {
  return `${difference.semanticActor}.${difference.component}.${difference.fieldPath}`
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
