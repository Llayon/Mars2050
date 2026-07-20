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
}
