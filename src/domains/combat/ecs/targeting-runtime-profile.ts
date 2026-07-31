export interface TargetingRuntimeProfile {
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
}

export function createTargetingRuntimeProfile(): TargetingRuntimeProfile {
  return {
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
  }
}
