import {
  canonicalSerialize,
  captureSemanticStateSnapshot,
  compareSemanticStates,
  type FirstSemanticStateDivergence,
} from './combat-semantic-state-diff'
import type {
  ActorTurnCell,
  ActorTurnComparison,
  ActorTurnTrace,
  GroupEndpointDivergence,
  ProcessingOrderDivergence,
  SectorPrefixDivergence,
  SemanticSector,
  SemanticActorBehaviorDivergence,
  SharedOrderTraceComparison,
} from './combat-actor-turn-reservation-types'

export function compareActorTurnCells(baseline: ActorTurnCell, candidate: ActorTurnCell): ActorTurnComparison {
  const preludeEquivalent = baseline.trace.prelude.length === candidate.trace.prelude.length &&
    baseline.trace.prelude.every((item, index) => item.label === candidate.trace.prelude[index]?.label &&
      compareSemanticStates(item.state, candidate.trace.prelude[index]!.state).equivalent &&
      canonicalSerialize(item.actions) === canonicalSerialize(candidate.trace.prelude[index]!.actions) &&
      item.movementRequestCount === candidate.trace.prelude[index]!.movementRequestCount)
  const initiativeGroupMembershipEquivalent = baseline.trace.groups.length === candidate.trace.groups.length &&
    baseline.trace.groups.every((group, index) => JSON.stringify(group.semanticMembers) === JSON.stringify(candidate.trace.groups[index]?.semanticMembers))
  const initiativeGroupStructureEquivalent = baseline.trace.groups.length === candidate.trace.groups.length &&
    baseline.trace.groups.every((group, index) => {
      const other = candidate.trace.groups[index]
      return other?.speed === group.speed &&
        canonicalSerialize(group.semanticMembers) === canonicalSerialize(other.semanticMembers)
    })
  return {
    preActorStateEquivalent: compareSemanticStates(baseline.trace.prelude[0]!.state, candidate.trace.prelude[0]!.state).equivalent,
    preludeEquivalent,
    initiativeGroupMembershipEquivalent,
    initiativeGroupStructureEquivalent,
    productionOrder: firstProcessingOrderDivergence(baseline.trace, candidate.trace),
    sectorPrefix: firstSectorPrefixDivergence(baseline.trace, candidate.trace),
    semanticActorBehavior: firstSemanticActorBehaviorDivergence(baseline.trace, candidate.trace),
    targetingDivergence: firstSemanticActorBehaviorDivergence(baseline.trace, candidate.trace, ['targeting.semanticTarget']),
    reservationDivergence: firstSemanticActorBehaviorDivergence(baseline.trace, candidate.trace, ['reservation.succeeded', 'reservation.slot', 'reservation.meleeSectors', 'reservation.state']),
    groupEndpoint: firstGroupEndpointDivergence(baseline.trace, candidate.trace),
    persistentDivergence: firstPersistentDivergence(baseline.trace.endpoint, candidate.trace.endpoint),
  }
}

export function compareSharedOrderTraces(baseline: ActorTurnTrace, candidate: ActorTurnTrace): SharedOrderTraceComparison {
  if (baseline.prelude.length !== candidate.prelude.length) {
    return traceDifference('prelude', 'length', baseline.prelude.length, candidate.prelude.length)
  }
  for (let index = 0; index < baseline.prelude.length; index++) {
    const left = baseline.prelude[index]!
    const right = candidate.prelude[index]!
    if (left.label !== right.label) return traceDifference('prelude', 'label', left.label, right.label)
    if (!compareSemanticStates(left.state, right.state).equivalent) return traceDifference('prelude', `${left.label}.state`, left.state, right.state)
    if (canonicalSerialize(left.actions) !== canonicalSerialize(right.actions)) return traceDifference('prelude', `${left.label}.actions`, left.actions, right.actions)
    if (left.movementRequestCount !== right.movementRequestCount) return traceDifference('prelude', `${left.label}.movementRequestCount`, left.movementRequestCount, right.movementRequestCount)
  }
  if (baseline.actors.length !== candidate.actors.length) return traceDifference('actor', 'count', baseline.actors.length, candidate.actors.length)
  const candidateActors = new Map(candidate.actors.map(actor => [actor.semanticActor, actor]))
  for (const left of baseline.actors) {
    const right = candidateActors.get(left.semanticActor)
    if (!right) return traceDifference('actor', 'missing', left.semanticActor, null, left.semanticActor)
    const actorFields: Array<[string, unknown, unknown]> = [
      ['before.meleeSectors', left.before.meleeSectors, right.before.meleeSectors],
      ['before.entityTargets', left.before.entityTargets, right.before.entityTargets],
      ['before.targeting', left.before.targeting, right.before.targeting],
      ['targeting.semanticTarget', left.targeting.semanticTarget, right.targeting.semanticTarget],
      ['targeting.meleeSectors', left.targeting.meleeSectors, right.targeting.meleeSectors],
      ['targeting.entityTargets', left.targeting.entityTargets, right.targeting.entityTargets],
      ['targeting.targeting', left.targeting.targeting, right.targeting.targeting],
      ['reservation.attempted', left.reservation.attempted, right.reservation.attempted],
      ['reservation.succeeded', left.reservation.succeeded, right.reservation.succeeded],
      ['reservation.semanticTarget', left.reservation.semanticTarget, right.reservation.semanticTarget],
      ['reservation.slot', left.reservation.slot, right.reservation.slot],
      ['reservation.waitingTarget', left.reservation.waitingTarget, right.reservation.waitingTarget],
      ['reservation.meleeSectors', left.reservation.meleeSectors, right.reservation.meleeSectors],
      ['reservation.state', left.reservation.state, right.reservation.state],
    ]
    const difference = actorFields.find(([, leftValue, rightValue]) => canonicalSerialize(leftValue) !== canonicalSerialize(rightValue))
    if (difference) return traceDifference('actor', difference[0], difference[1], difference[2], left.semanticActor)
  }
  if (baseline.groups.length !== candidate.groups.length) return traceDifference('group', 'count', baseline.groups.length, candidate.groups.length)
  for (let index = 0; index < baseline.groups.length; index++) {
    const left = baseline.groups[index]!
    const right = candidate.groups[index]!
    const groupFields: Array<[string, unknown, unknown]> = [
      ['speed', left.speed, right.speed],
      ['semanticMembers', left.semanticMembers, right.semanticMembers],
      ['processedOrder', left.processedOrder, right.processedOrder],
      ['actionIntents', canonicalCollection(left.actionIntents), canonicalCollection(right.actionIntents)],
      ['movementRequests', left.movementRequests, right.movementRequests],
      ['actions', canonicalCollection(left.actions), canonicalCollection(right.actions)],
      ['endpoint', left.endpoint, right.endpoint],
    ]
    const difference = groupFields.find(([, leftValue, rightValue]) => canonicalSerialize(leftValue) !== canonicalSerialize(rightValue))
    if (difference) return traceDifference('group', `group[${index}].${difference[0]}`, difference[1], difference[2], undefined, index)
  }
  const finalFields: Array<[string, unknown, unknown]> = [
    ['endpoint', baseline.endpoint, candidate.endpoint],
    ['normalizedActions', baseline.normalizedActions, candidate.normalizedActions],
    ['movementRequests', baseline.movementRequests, candidate.movementRequests],
  ]
  const difference = finalFields.find(([, leftValue, rightValue]) => canonicalSerialize(leftValue) !== canonicalSerialize(rightValue))
  return difference ? traceDifference('endpoint', difference[0], difference[1], difference[2]) : { equivalent: true, firstDifference: null }
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

function firstSectorPrefixDivergence(baseline: ActorTurnTrace, candidate: ActorTurnTrace): SectorPrefixDivergence | null {
  for (let groupOrdinal = 0; groupOrdinal < Math.min(baseline.groups.length, candidate.groups.length); groupOrdinal++) {
    const leftActors = baseline.actors.filter(actor => actor.groupOrdinal === groupOrdinal).sort((left, right) => left.processingOrdinal - right.processingOrdinal)
    const rightActors = candidate.actors.filter(actor => actor.groupOrdinal === groupOrdinal).sort((left, right) => left.processingOrdinal - right.processingOrdinal)
    for (let index = 0; index < Math.min(leftActors.length, rightActors.length); index++) {
      const left = leftActors[index]!
      const right = rightActors[index]!
      const stages: Array<[SectorPrefixDivergence['stage'], SemanticSector[], SemanticSector[]]> = [
        ['before_actor', left.before.meleeSectors, right.before.meleeSectors],
        ['after_targeting', left.targeting.meleeSectors, right.targeting.meleeSectors],
        ['after_reservation', left.reservation.meleeSectors, right.reservation.meleeSectors],
      ]
      const difference = stages.find(([, leftSectors, rightSectors]) => canonicalSerialize(leftSectors) !== canonicalSerialize(rightSectors))
      if (difference) {
        return {
          groupOrdinal, speed: baseline.groups[groupOrdinal]!.speed, processingOrdinal: left.processingOrdinal,
          stage: difference[0], baselineSemanticActor: left.semanticActor, candidateSemanticActor: right.semanticActor,
          baselineValue: difference[1], candidateValue: difference[2],
        }
      }
    }
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

function canonicalCollection(values: readonly unknown[]): unknown[] {
  return [...values].sort((left, right) => {
    const leftSerialized = canonicalSerialize(left)
    const rightSerialized = canonicalSerialize(right)
    return leftSerialized < rightSerialized ? -1 : leftSerialized > rightSerialized ? 1 : 0
  })
}

function traceDifference(
  scope: 'prelude' | 'actor' | 'group' | 'endpoint', field: string, baselineValue: unknown, candidateValue: unknown,
  semanticActor?: string, groupOrdinal?: number,
): SharedOrderTraceComparison {
  return { equivalent: false, firstDifference: { scope, field, baselineValue, candidateValue, ...(semanticActor ? { semanticActor } : {}), ...(groupOrdinal === undefined ? {} : { groupOrdinal }) } }
}

function formatDifference(difference: FirstSemanticStateDivergence): string {
  return `${difference.semanticActor}.${difference.component}.${difference.fieldPath}`
}
