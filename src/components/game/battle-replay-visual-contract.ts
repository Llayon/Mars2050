import {
  REPLAY_SPRITE_ALIASES,
  REPLAY_VISUAL_ASSETS,
  REPLAY_VISUAL_COVERAGE_EXEMPTIONS,
  getReplayVisualAssetPublicPaths,
  isReplayVisualCoverageExempt,
} from './battle-replay-visual-registry'

export interface ReplayVisualCoverageIssue {
  type: string
  code: 'aliased-current-unit' | 'missing-asset' | 'missing-file' | 'exempt-with-asset'
  detail: string
}

export function getReplayVisualCoverageIssues(
  unitTypes: readonly string[],
  assetExists: (publicPath: string) => boolean
): ReplayVisualCoverageIssue[] {
  const issues: ReplayVisualCoverageIssue[] = []
  const currentUnits = new Set(unitTypes)

  Object.keys(REPLAY_SPRITE_ALIASES).forEach(type => {
    if (currentUnits.has(type)) {
      issues.push({ type, code: 'aliased-current-unit', detail: 'current combat units must use direct replay assets' })
    }
  })

  unitTypes.forEach(type => {
    const asset = (REPLAY_VISUAL_ASSETS as Partial<Record<string, unknown>>)[type]
    const exempt = isReplayVisualCoverageExempt(type)
    if (exempt && asset) {
      issues.push({ type, code: 'exempt-with-asset', detail: 'visual exemption should not also declare an asset' })
      return
    }
    if (exempt) return
    if (!asset) {
      issues.push({ type, code: 'missing-asset', detail: 'unit has no direct replay visual asset' })
      return
    }

    getReplayVisualAssetPublicPaths(type).forEach(path => {
      if (!assetExists(path)) issues.push({ type, code: 'missing-file', detail: path })
    })
  })

  return issues
}

export function getReplayVisualCoverageSummary(unitTypes: readonly string[]): {
  unitCount: number
  directAssetCount: number
  exemptionCount: number
  aliasCount: number
} {
  return {
    unitCount: unitTypes.length,
    directAssetCount: unitTypes.filter(type => (REPLAY_VISUAL_ASSETS as Partial<Record<string, unknown>>)[type]).length,
    exemptionCount: REPLAY_VISUAL_COVERAGE_EXEMPTIONS.length,
    aliasCount: Object.keys(REPLAY_SPRITE_ALIASES).length,
  }
}
