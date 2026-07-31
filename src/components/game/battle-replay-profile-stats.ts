import type { ReplayRenderCounters } from './battle-replay-profile'

export const REPLAY_PROFILE_TIMING_KEYS = [
  'frameIntervalMs',
  'runtimeMs',
  'crowdPlanMs',
  'unitSyncMs',
  'effectsMs',
  'renderSubmitMs',
  'totalCpuMs',
] as const

export type ReplayProfileTiming =
  (typeof REPLAY_PROFILE_TIMING_KEYS)[number]

export interface ReplayTimingStats {
  p50: number
  p95: number
  max: number
}

export function createFrameTimings(): Record<ReplayProfileTiming, number> {
  return Object.fromEntries(
    REPLAY_PROFILE_TIMING_KEYS.map(key => [key, 0]),
  ) as Record<ReplayProfileTiming, number>
}

export function createTimingBuffers(
  capacity: number,
): Record<ReplayProfileTiming, Float64Array> {
  return Object.fromEntries(
    REPLAY_PROFILE_TIMING_KEYS.map(
      key => [key, new Float64Array(capacity)],
    ),
  ) as Record<ReplayProfileTiming, Float64Array>
}

export function resetFrameTimings(
  timings: Record<ReplayProfileTiming, number>,
): void {
  for (const key of REPLAY_PROFILE_TIMING_KEYS) timings[key] = 0
}

export function resetReplayRenderCounters(
  counters: ReplayRenderCounters,
): void {
  for (const key of Object.keys(counters) as (keyof ReplayRenderCounters)[]) {
    counters[key] = 0
  }
}

export function copyCounters(
  target: ReplayRenderCounters,
  source: ReplayRenderCounters,
): void {
  for (const key of Object.keys(target) as (keyof ReplayRenderCounters)[]) {
    target[key] = source[key]
  }
}

export function addCounters(
  target: ReplayRenderCounters,
  source: ReplayRenderCounters,
): void {
  for (const key of Object.keys(target) as (keyof ReplayRenderCounters)[]) {
    target[key] += source[key]
  }
}

export function buildTimingStats(
  samples: Record<ReplayProfileTiming, Float64Array>,
  sampleCount: number,
): Record<ReplayProfileTiming, ReplayTimingStats> {
  return Object.fromEntries(REPLAY_PROFILE_TIMING_KEYS.map(key => [
    key,
    calculateStats(samples[key], sampleCount),
  ])) as Record<ReplayProfileTiming, ReplayTimingStats>
}

function calculateStats(
  values: Float64Array,
  sampleCount: number,
): ReplayTimingStats {
  if (sampleCount === 0) return { p50: 0, p95: 0, max: 0 }
  const sorted = Array.from(values.subarray(0, sampleCount))
    .sort((left, right) => left - right)
  return {
    p50: roundTiming(percentile(sorted, 0.5)),
    p95: roundTiming(percentile(sorted, 0.95)),
    max: roundTiming(sorted[sorted.length - 1]),
  }
}

function percentile(sorted: number[], ratio: number): number {
  return sorted[Math.ceil(sorted.length * ratio) - 1] ?? 0
}

function roundTiming(value: number): number {
  return Math.round(value * 1000) / 1000
}
