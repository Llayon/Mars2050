import { describe, expect, it, vi } from 'vitest'
import {
  installReplayProfileExport,
  isReplayRenderProfilingEnabled,
  REPLAY_PROFILE_READY_EVENT,
  REPLAY_PROFILE_REQUEST_EVENT,
  ReplayRenderProfiler,
} from '@/components/game/battle-replay-profile'

const budget = {
  resolution: 1,
  maxFps: 30,
  clusterUnitStride: 3,
  corpseLifetimeMs: 700,
  maxFloatingTexts: 12,
}

function createProfiler(warmupFrames = 1, capacity = 3) {
  return new ReplayRenderProfiler({
    unitCount: 100,
    renderBudget: budget,
    viewportWidth: 390,
    viewportHeight: 844,
    devicePixelRatio: 1,
    userAgent: 'test',
    warmupFrames,
    capacity,
  })
}

function recordFrame(
  profiler: ReplayRenderProfiler,
  start: number,
  duration: number,
): void {
  profiler.beginFrame(start)
  profiler.recordRuntime(1)
  profiler.recordCrowdPlan(2)
  profiler.recordUnitSync(3)
  profiler.recordEffects(4)
  profiler.frameCounters.visibleUnitUpdates = 100
  profiler.finishDraw(start + duration - 1)
  profiler.finishFrame(start + duration)
}

describe('ReplayRenderProfiler', () => {
  it('excludes warmup frames and keeps a bounded sample ring', () => {
    const profiler = createProfiler()
    recordFrame(profiler, 10, 12)
    recordFrame(profiler, 50, 13)
    recordFrame(profiler, 90, 14)
    recordFrame(profiler, 130, 15)
    recordFrame(profiler, 170, 16)

    const snapshot = profiler.snapshot()
    expect(snapshot.sampling).toEqual({
      warmupFrames: 1,
      capacity: 3,
      sampleCount: 3,
    })
    expect(snapshot.timings.runtimeMs).toEqual({ p50: 1, p95: 1, max: 1 })
    expect(snapshot.timings.totalCpuMs).toEqual({ p50: 15, p95: 16, max: 16 })
    expect(snapshot.counters.visibleUnitUpdates).toBe(400)
    expect(snapshot.lastFrameCounters.visibleUnitUpdates).toBe(100)
  })

  it('exports versioned JSON only after an enabled canvas request', () => {
    const canvas = document.createElement('canvas')
    const profiler = createProfiler(0)
    recordFrame(profiler, 10, 12)
    const ready = vi.fn()
    canvas.addEventListener(REPLAY_PROFILE_READY_EVENT, ready)
    const cleanup = installReplayProfileExport(canvas, profiler)

    expect(canvas.dataset.replayProfileJson).toBeUndefined()
    canvas.dispatchEvent(new CustomEvent(REPLAY_PROFILE_REQUEST_EVENT))

    expect(ready).toHaveBeenCalledOnce()
    expect(JSON.parse(canvas.dataset.replayProfileJson ?? '{}')).toMatchObject({
      version: 1,
      renderer: 'pixi',
      sampling: { sampleCount: 1 },
    })

    cleanup()
    expect(canvas.dataset.replayProfileJson).toBeUndefined()
  })

  it('requires the explicit replayProfile query flag', () => {
    expect(isReplayRenderProfilingEnabled('?replayProfile=1')).toBe(true)
    expect(isReplayRenderProfilingEnabled('?replayProfile=0')).toBe(false)
    expect(isReplayRenderProfilingEnabled('')).toBe(false)
  })

  it('exports the latest sparse scene graph profile', () => {
    const profiler = createProfiler(0)
    profiler.setSceneProfile({
      unitContainers: 605,
      visibleUnitContainers: 605,
      activeUnitChildren: 1815,
      activeOptionalGraphics: 0,
      activeOptionalTexts: 0,
      pooledGraphics: 24,
      pooledTexts: 4,
    })

    expect(profiler.snapshot().scene).toEqual({
      unitContainers: 605,
      visibleUnitContainers: 605,
      activeUnitChildren: 1815,
      activeOptionalGraphics: 0,
      activeOptionalTexts: 0,
      pooledGraphics: 24,
      pooledTexts: 4,
    })
  })
})
