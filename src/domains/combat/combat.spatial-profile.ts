export interface SpatialQueryProfile {
  queryCount: number
  candidateCount: number
  maxCandidates: number
  bucketCandidateCount: number
  rebuildCount: number
  incrementalUpdateCount: number
  componentQueryCount: number
  componentCandidateCount: number
  componentResultCount: number
  componentCacheHitCount: number
  pairQueryCount: number
  pairBucketCandidateCount: number
  pairResultCount: number
  movementBatchCount: number
  movementIntentCount: number
  neighborCandidatePairCount: number
  neighborEdgeCount: number
  collisionCandidatePairCount: number
  collisionOverlapPairCount: number
  dirtyCellCount: number
  targetingFrameBuildCount: number
  targetingFrameEntityCount: number
  targetingAcquisitionCount: number
  targetingBucketCandidateCount: number
  targetingCandidateCount: number
  targetingMaxCandidates: number
  targetingDirtyCandidateCount: number
  targetingLegacyFallbackCount: number
  targetingScratchGrowthCount: number
  targetingFrameBuildMs: number
  targetingQueryMs: number
  targetingSelectionMs: number
  purposes: Record<string, SpatialPurposeProfile>
}

export interface SpatialPurposeProfile {
  queryCount: number
  bucketCandidateCount: number
  candidateCount: number
}
