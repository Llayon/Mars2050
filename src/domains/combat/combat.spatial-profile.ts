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
  purposes: Record<string, SpatialPurposeProfile>
}

export interface SpatialPurposeProfile {
  queryCount: number
  bucketCandidateCount: number
  candidateCount: number
}
