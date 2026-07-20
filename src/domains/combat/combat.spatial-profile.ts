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
  purposes: Record<string, SpatialPurposeProfile>
}

export interface SpatialPurposeProfile {
  queryCount: number
  bucketCandidateCount: number
  candidateCount: number
}
