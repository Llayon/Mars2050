import {
  REPLAY_SPRITE_ALIASES,
  REPLAY_SPRITE_DIRECTIONS,
  REPLAY_VISUAL_ASSETS,
  REPLAY_VISUAL_COVERAGE_EXEMPTIONS,
  getReplayVisualAssetPublicPaths,
  isReplayVisualCoverageExempt,
  type ReplayVisualAsset,
} from './battle-replay-visual-registry'

export interface ReplayVisualCoverageIssue {
  type: string
  code:
    | 'aliased-current-unit'
    | 'missing-asset'
    | 'missing-file'
    | 'exempt-with-asset'
    | 'invalid-clip-config'
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
    const configIssue = getReplayVisualClipConfigIssue(
      asset as ReplayVisualAsset,
    )
    if (configIssue) {
      issues.push({
        type,
        code: 'invalid-clip-config',
        detail: configIssue,
      })
    }
  })

  return issues
}

export function getReplayVisualClipConfigIssue(
  asset: ReplayVisualAsset,
): string | null {
  if (!asset.clips) return null
  if (asset.kind !== 'atlas') return 'animation clips require an atlas asset'
  if (
    !isPositiveInteger(asset.sourceWidth) ||
    !isPositiveInteger(asset.sourceHeight) ||
    !isPositiveInteger(asset.atlasFrameCount)
  ) {
    return 'animated atlas requires frame dimensions and atlasFrameCount'
  }
  if (
    asset.directionOrder &&
    (
      asset.directionOrder.length !== REPLAY_SPRITE_DIRECTIONS.length ||
      new Set(asset.directionOrder).size !==
        REPLAY_SPRITE_DIRECTIONS.length ||
      asset.directionOrder.some(
        direction => !REPLAY_SPRITE_DIRECTIONS.includes(direction),
      )
    )
  ) {
    return 'directionOrder must contain every replay direction once'
  }

  for (const [clip, config] of Object.entries(asset.clips)) {
    if (
      !Number.isInteger(config.startFrame) ||
      config.startFrame < 0 ||
      !Number.isInteger(config.frameCount) ||
      config.frameCount < 1 ||
      !Number.isFinite(config.fps) ||
      config.fps <= 0
    ) {
      return `${clip} has invalid timing or frame values`
    }
    const stride = config.directionStride ?? config.frameCount
    if (!Number.isInteger(stride) || stride < config.frameCount) {
      return `${clip} directionStride must cover every clip frame`
    }
    const lastFrameExclusive =
      config.startFrame + 7 * stride + config.frameCount
    if (lastFrameExclusive > asset.atlasFrameCount) {
      return `${clip} exceeds atlasFrameCount`
    }
  }
  return null
}

function isPositiveInteger(value: number | undefined): value is number {
  return Number.isInteger(value) && (value ?? 0) > 0
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
