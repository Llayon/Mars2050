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
    purposes: {},
  }
}
