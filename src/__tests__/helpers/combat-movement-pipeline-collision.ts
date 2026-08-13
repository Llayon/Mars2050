import { buildMovementCollisionPairs } from '@/domains/combat/ecs/movement-collision-pairs'
import type { EcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import type { EntityId } from '@/domains/combat/ecs/entity'
import type { MovementFrame } from '@/domains/combat/ecs/movement-batch.types'
import type { OrderingProbeResult } from './combat-ordering-probes'
import type { StageComparison } from './combat-movement-pipeline-diagnostics'
import type { CollisionPairRecord, FirstCollisionResultDivergence, FallbackVector, PipelineCellResult, SupportingExactOverlapPair } from './combat-movement-pipeline-types'

export function captureCollisionPairs(runtime: EcsCombatRuntime, frame: MovementFrame, x: readonly number[], y: readonly number[], dirty: ReadonlySet<EntityId>, probe: OrderingProbeResult): CollisionPairRecord[] {
  const pairs = buildMovementCollisionPairs(frame.entityIds, x, y, dirty, 201.6)
  return pairs.map(([firstId, secondId], pairOrder) => {
    const first = runtime.world.stores.entityMeta.require(firstId).externalId
    const second = runtime.world.stores.entityMeta.require(secondId).externalId
    const dx = x[secondId] - x[firstId], dy = y[secondId] - y[firstId]
    return {
      semanticPair: [semanticId(runtime, firstId, probe), semanticId(runtime, secondId, probe)].sort(compareString) as [string, string],
      externalIdPair: [first, second].sort(compareString) as [string, string],
      orderedExternalIds: [first, second], internalEntityIdPair: [firstId, secondId], hashKey: fallbackHashKey(first, second),
      fallbackVector: predictCollisionFallbackVector(first, second), x1: x[firstId], y1: y[firstId], x2: x[secondId], y2: y[secondId],
      distanceSquared: dx * dx + dy * dy, pairOrder, fallbackReachable: dx === 0 && dy === 0,
    }
  })
}

export function predictCollisionFallbackVector(firstExternalId: string, secondExternalId: string): FallbackVector {
  let hash = 2166136261
  const ordered = firstExternalId < secondExternalId ? `${firstExternalId}:${secondExternalId}` : `${secondExternalId}:${firstExternalId}`
  for (let index = 0; index < ordered.length; index++) {
    hash ^= ordered.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const angle = ((hash >>> 0) / 4294967295) * Math.PI * 2 + (firstExternalId < secondExternalId ? 0 : Math.PI)
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

export function findSupportingExactOverlapPairs(left: PipelineCellResult, right: PipelineCellResult, comparison: StageComparison): SupportingExactOverlapPair[] {
  if (!comparison.stage0Equivalent || !comparison.requestPayloadEquivalent || !comparison.intentEquivalent ||
      !comparison.collisionPairSetEquivalent || !comparison.collisionPairOrderEquivalent ||
      !comparison.firstCollisionResultDivergence || comparison.collisionEquivalent) return []
  const actor = comparison.firstCollisionResultDivergence.semanticActor
  const result: SupportingExactOverlapPair[] = []
  for (const baseline of left.preSolverExactCollisionPairs) {
    if (!baseline.semanticPair.includes(actor) || !baseline.orderedExternalIds || !baseline.hashKey || !baseline.fallbackVector) continue
    const candidate = right.preSolverExactCollisionPairs.find(pair => pair.semanticPair.join('|') === baseline.semanticPair.join('|'))
    if (!candidate || !candidate.orderedExternalIds || !candidate.hashKey || !candidate.fallbackVector) continue
    if (JSON.stringify(baseline.internalEntityIdPair) !== JSON.stringify(candidate.internalEntityIdPair)) continue
    if (JSON.stringify(baseline.orderedExternalIds) === JSON.stringify(candidate.orderedExternalIds)) continue
    if (baseline.fallbackVector.x === candidate.fallbackVector.x && baseline.fallbackVector.y === candidate.fallbackVector.y) continue
    result.push({
      semanticPair: baseline.semanticPair, internalEntityIdPair: baseline.internalEntityIdPair,
      baselineOrderedExternalIds: baseline.orderedExternalIds, candidateOrderedExternalIds: candidate.orderedExternalIds,
      baselineHashKey: baseline.hashKey, candidateHashKey: candidate.hashKey,
      baselineFallbackVector: baseline.fallbackVector, candidateFallbackVector: candidate.fallbackVector,
    })
  }
  return result
}

export function firstCollisionDivergence(left: PipelineCellResult, right: PipelineCellResult): FirstCollisionResultDivergence | null {
  const actors = [...new Set([...Object.keys(left.collisionResultBySemanticActor), ...Object.keys(right.collisionResultBySemanticActor)])].sort(compareString)
  for (const semanticActor of actors) {
    const baseline = left.collisionResultBySemanticActor[semanticActor]
    const candidate = right.collisionResultBySemanticActor[semanticActor]
    if (!baseline || !candidate) return { semanticActor, field: 'missing', baselineValue: baseline ?? null, candidateValue: candidate ?? null }
    for (const field of ['x', 'y', 'velocityX', 'velocityY', 'corrected'] as const) {
      if (baseline[field] !== candidate[field]) return { semanticActor, field, baselineValue: baseline[field], candidateValue: candidate[field] }
    }
  }
  return null
}

function fallbackHashKey(firstExternalId: string, secondExternalId: string): string {
  return firstExternalId < secondExternalId ? `${firstExternalId}:${secondExternalId}` : `${secondExternalId}:${firstExternalId}`
}

function semanticId(runtime: EcsCombatRuntime, entityId: EntityId, probe: OrderingProbeResult): string {
  const externalId = runtime.world.stores.identity.require(entityId).id
  const identity = probe.semanticByExternalId.get(externalId)
  return identity ? `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}` : externalId
}

function compareString(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0 }
