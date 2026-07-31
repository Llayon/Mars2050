import type { SpatialQueryProfile } from '../combat.spatial-profile'

export function createSpatialQueryProfile(): SpatialQueryProfile {
  return {
    queryCount: 0,
    candidateCount: 0,
    maxCandidates: 0,
    bucketCandidateCount: 0,
    rebuildCount: 0,
    incrementalUpdateCount: 0,
    componentQueryCount: 0,
    componentCandidateCount: 0,
    componentResultCount: 0,
    componentCacheHitCount: 0,
    pairQueryCount: 0,
    pairBucketCandidateCount: 0,
    pairResultCount: 0,
    movementBatchCount: 0,
    movementIntentCount: 0,
    neighborCandidatePairCount: 0,
    neighborEdgeCount: 0,
    collisionCandidatePairCount: 0,
    collisionOverlapPairCount: 0,
    dirtyCellCount: 0,
    targetingFrameBuildCount: 0,
    targetingFrameEntityCount: 0,
    targetingAcquisitionCount: 0,
    targetingBucketCandidateCount: 0,
    targetingCandidateCount: 0,
    targetingMaxCandidates: 0,
    targetingDirtyCandidateCount: 0,
    targetingLegacyFallbackCount: 0,
    targetingScratchGrowthCount: 0,
    targetingFrameBuildMs: 0,
    targetingQueryMs: 0,
    targetingSelectionMs: 0,
    purposes: {},
  }
}

export interface BatchMovementProfileInput {
  intents: number
  neighborCandidates: number
  neighborEdges: number
  collisionCandidates: number
  collisionOverlaps: number
  dirtyCells: number
}

export function recordBatchMovementProfile(
  profile: SpatialQueryProfile,
  stats: BatchMovementProfileInput,
): void {
  profile.movementBatchCount++
  profile.movementIntentCount += stats.intents
  profile.neighborCandidatePairCount += stats.neighborCandidates
  profile.neighborEdgeCount += stats.neighborEdges
  profile.collisionCandidatePairCount += stats.collisionCandidates
  profile.collisionOverlapPairCount += stats.collisionOverlaps
  profile.dirtyCellCount += stats.dirtyCells
}
