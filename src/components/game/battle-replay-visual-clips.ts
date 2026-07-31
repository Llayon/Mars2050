import type {
  ReplayVisualClip,
  ReplayVisualDirection,
} from './battle-replay-canvas-types'
import {
  REPLAY_SPRITE_DIRECTIONS,
  getReplayVisualAsset,
  type ReplayVisualClipConfig,
} from './battle-replay-visual-registry'

const DEFAULT_ATTACK_DURATION_MS = 220
const clipDurationCache = new Map<string, number>()
const animatedTypeCache = new Map<string, boolean>()

export interface ReplayResolvedClipFrame {
  clip: ReplayVisualClip
  animationFrame: number
  atlasFrame: number
}

export function normalizeReplayVisualDirection(
  direction: string,
): ReplayVisualDirection {
  return (REPLAY_SPRITE_DIRECTIONS as readonly string[]).includes(direction)
    ? direction as ReplayVisualDirection
    : 'south'
}

export function getReplayVisualClipDuration(
  type: string,
  clip: ReplayVisualClip,
): number {
  const key = `${type}:${clip}`
  const cached = clipDurationCache.get(key)
  if (cached !== undefined) return cached
  const config = getReplayVisualAsset(type)?.asset.clips?.[clip]
  const duration = config
    ? Math.max(1, config.frameCount) * (1000 / Math.max(1, config.fps))
    : clip === 'attack' ? DEFAULT_ATTACK_DURATION_MS : 0
  clipDurationCache.set(key, duration)
  return duration
}

export function hasReplayVisualClips(type: string): boolean {
  const cached = animatedTypeCache.get(type)
  if (cached !== undefined) return cached
  const animated = Boolean(getReplayVisualAsset(type)?.asset.clips)
  animatedTypeCache.set(type, animated)
  return animated
}

export function resolveReplayVisualClipFrame(
  type: string,
  requestedClip: ReplayVisualClip,
  direction: ReplayVisualDirection,
  elapsedMs: number,
): ReplayResolvedClipFrame {
  const asset = getReplayVisualAsset(type)?.asset
  const configuredClip = asset?.clips?.[requestedClip]
    ? requestedClip
    : 'idle'
  const config = asset?.clips?.[configuredClip]
  if (!config) {
    return { clip: 'idle', animationFrame: 0, atlasFrame: 0 }
  }

  const animationFrame = resolveReplayAnimationFrame(config, elapsedMs)
  const directionOrder =
    asset?.directionOrder ?? REPLAY_SPRITE_DIRECTIONS
  const directionIndex = Math.max(0, directionOrder.indexOf(direction))
  return {
    clip: configuredClip,
    animationFrame,
    atlasFrame:
      config.startFrame +
      directionIndex * (config.directionStride ?? config.frameCount) +
      animationFrame,
  }
}

export function resolveReplayAnimationFrame(
  config: ReplayVisualClipConfig,
  elapsedMs: number,
): number {
  const frameCount = Math.max(1, config.frameCount)
  const elapsedFrames = Math.floor(
    Math.max(0, elapsedMs) / (1000 / Math.max(1, config.fps)),
  )
  return config.loop === false
    ? Math.min(frameCount - 1, elapsedFrames)
    : elapsedFrames % frameCount
}
