import type { ReplayRenderBudget } from './battle-replay-quality'
import type {
  ReplayProfileTiming,
  ReplayTimingStats,
} from './battle-replay-profile-stats'

export interface ReplayRenderCounters {
  visibleUnitUpdates: number
  positionChanges: number
  depthChanges: number
  spriteChanges: number
  fallbackRebuilds: number
  hpRebuilds: number
  flashRebuilds: number
  hitboxRebuilds: number
  velocityRebuilds: number
  statusChanges: number
  animationFrameChanges: number
}

export interface ReplaySceneProfile {
  unitContainers: number
  visibleUnitContainers: number
  activeUnitChildren: number
  activeOptionalGraphics: number
  activeOptionalTexts: number
  pooledGraphics: number
  pooledTexts: number
}

export interface ReplayRenderProfileSnapshot {
  version: 1
  renderer: 'pixi'
  environment: {
    initialUnitCount: number
    latestUnitCount: number
    peakUnitCount: number
    viewportWidth: number
    viewportHeight: number
    devicePixelRatio: number
    userAgent: string
  }
  renderBudget: ReplayRenderBudget
  sampling: {
    warmupFrames: number
    capacity: number
    sampleCount: number
  }
  timings: Record<ReplayProfileTiming, ReplayTimingStats>
  longFrameCount: number
  droppedFrameEstimate: number
  counters: ReplayRenderCounters
  lastFrameCounters: ReplayRenderCounters
  scene: ReplaySceneProfile
}

export function createReplayRenderCounters(): ReplayRenderCounters {
  return {
    visibleUnitUpdates: 0,
    positionChanges: 0,
    depthChanges: 0,
    spriteChanges: 0,
    fallbackRebuilds: 0,
    hpRebuilds: 0,
    flashRebuilds: 0,
    hitboxRebuilds: 0,
    velocityRebuilds: 0,
    statusChanges: 0,
    animationFrameChanges: 0,
  }
}

export function createReplaySceneProfile(): ReplaySceneProfile {
  return {
    unitContainers: 0,
    visibleUnitContainers: 0,
    activeUnitChildren: 0,
    activeOptionalGraphics: 0,
    activeOptionalTexts: 0,
    pooledGraphics: 0,
    pooledTexts: 0,
  }
}
