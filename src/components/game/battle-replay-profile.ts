import type { ReplayRenderBudget } from './battle-replay-quality'
import {
  addCounters,
  buildTimingStats,
  copyCounters,
  createFrameTimings,
  createTimingBuffers,
  REPLAY_PROFILE_TIMING_KEYS,
  resetFrameTimings,
  resetReplayRenderCounters,
  type ReplayProfileTiming,
  type ReplayTimingStats,
} from './battle-replay-profile-stats'

export const REPLAY_PROFILE_REQUEST_EVENT =
  'mars2050:replay-profile-request'
export const REPLAY_PROFILE_READY_EVENT =
  'mars2050:replay-profile-ready'

const DEFAULT_WARMUP_FRAMES = 30
const DEFAULT_SAMPLE_CAPACITY = 600
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
}

interface ReplayProfilerOptions {
  unitCount: number
  renderBudget: ReplayRenderBudget
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number
  userAgent: string
  warmupFrames?: number
  capacity?: number
}

export class ReplayRenderProfiler {
  readonly frameCounters = createReplayRenderCounters()

  private readonly warmupFrames: number
  private readonly capacity: number
  private readonly renderBudget: ReplayRenderBudget
  private readonly environment: ReplayRenderProfileSnapshot['environment']
  private readonly samples: Record<ReplayProfileTiming, Float64Array>
  private readonly frameTimings = createFrameTimings()
  private readonly counters = createReplayRenderCounters()
  private readonly lastFrameCounters = createReplayRenderCounters()
  private sampleCount = 0
  private sampleCursor = 0
  private completedFrames = 0
  private frameStartedAt = 0
  private drawFinishedAt = 0
  private lastFrameStartedAt = 0
  private frameActive = false
  private longFrameCount = 0
  private droppedFrameEstimate = 0

  constructor(options: ReplayProfilerOptions) {
    this.warmupFrames = options.warmupFrames ?? DEFAULT_WARMUP_FRAMES
    this.capacity = options.capacity ?? DEFAULT_SAMPLE_CAPACITY
    this.renderBudget = { ...options.renderBudget }
    this.environment = {
      initialUnitCount: options.unitCount,
      latestUnitCount: options.unitCount,
      peakUnitCount: options.unitCount,
      viewportWidth: options.viewportWidth,
      viewportHeight: options.viewportHeight,
      devicePixelRatio: options.devicePixelRatio,
      userAgent: options.userAgent,
    }
    this.samples = createTimingBuffers(this.capacity)
  }

  now(): number {
    return performance.now()
  }

  beginFrame(now: number): void {
    this.frameActive = true
    this.frameStartedAt = now
    this.drawFinishedAt = now
    resetReplayRenderCounters(this.frameCounters)
    resetFrameTimings(this.frameTimings)
    if (this.lastFrameStartedAt > 0) {
      this.frameTimings.frameIntervalMs = now - this.lastFrameStartedAt
    }
    this.lastFrameStartedAt = now
  }

  setUnitCount(unitCount: number): void {
    this.environment.latestUnitCount = unitCount
    this.environment.peakUnitCount =
      Math.max(this.environment.peakUnitCount, unitCount)
  }

  recordRuntime(duration: number): void {
    this.frameTimings.runtimeMs += duration
  }

  recordCrowdPlan(duration: number): void {
    this.frameTimings.crowdPlanMs += duration
  }

  recordUnitSync(duration: number): void {
    this.frameTimings.unitSyncMs += duration
  }

  recordEffects(duration: number): void {
    this.frameTimings.effectsMs += duration
  }

  finishDraw(now: number): void {
    this.drawFinishedAt = now
  }

  finishFrame(now: number): void {
    if (!this.frameActive) return
    this.frameActive = false
    this.frameTimings.renderSubmitMs = Math.max(0, now - this.drawFinishedAt)
    this.frameTimings.totalCpuMs = Math.max(0, now - this.frameStartedAt)
    copyCounters(this.lastFrameCounters, this.frameCounters)

    if (this.completedFrames >= this.warmupFrames) {
      this.storeFrame()
    }
    this.completedFrames++
  }

  snapshot(): ReplayRenderProfileSnapshot {
    return {
      version: 1,
      renderer: 'pixi',
      environment: { ...this.environment },
      renderBudget: { ...this.renderBudget },
      sampling: {
        warmupFrames: this.warmupFrames,
        capacity: this.capacity,
        sampleCount: this.sampleCount,
      },
      timings: buildTimingStats(this.samples, this.sampleCount),
      longFrameCount: this.longFrameCount,
      droppedFrameEstimate: this.droppedFrameEstimate,
      counters: { ...this.counters },
      lastFrameCounters: { ...this.lastFrameCounters },
    }
  }

  private storeFrame(): void {
    for (const key of REPLAY_PROFILE_TIMING_KEYS) {
      this.samples[key][this.sampleCursor] = this.frameTimings[key]
    }
    addCounters(this.counters, this.frameCounters)

    const targetInterval = 1000 / this.renderBudget.maxFps
    const interval = this.frameTimings.frameIntervalMs
    if (interval > targetInterval * 1.5) this.longFrameCount++
    this.droppedFrameEstimate += Math.max(
      0,
      Math.round(interval / targetInterval) - 1,
    )
    this.sampleCursor = (this.sampleCursor + 1) % this.capacity
    this.sampleCount = Math.min(this.capacity, this.sampleCount + 1)
  }
}

export function isReplayRenderProfilingEnabled(
  search = window.location.search,
): boolean {
  return new URLSearchParams(search).get('replayProfile') === '1'
}

export function installReplayProfileExport(
  canvas: HTMLCanvasElement,
  profiler: ReplayRenderProfiler,
): () => void {
  const handleRequest = () => {
    canvas.dataset.replayProfileJson = JSON.stringify(profiler.snapshot())
    canvas.dispatchEvent(new CustomEvent(REPLAY_PROFILE_READY_EVENT))
  }
  canvas.addEventListener(REPLAY_PROFILE_REQUEST_EVENT, handleRequest)
  return () => {
    canvas.removeEventListener(REPLAY_PROFILE_REQUEST_EVENT, handleRequest)
    delete canvas.dataset.replayProfileJson
  }
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
  }
}
