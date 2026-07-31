import { Rectangle, Sprite, Texture } from 'pixi.js'
import type { ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdRenderMode, ReplayCrowdUnitView } from './battle-replay-density'
import { resolveReplaySprite, type ReplaySpriteFrame } from './battle-replay-sprites'
import { UNIT_VISUALS } from './battle-replay-visuals'
import type { ReplayRenderCounters } from './battle-replay-profile'
import { resolveReplayUnitVisualState } from './battle-replay-visual-state'
import { hasReplayVisualClips } from './battle-replay-visual-clips'

export interface PixiReplaySpriteState {
  type: string
  direction: string
  clip: string
  animationFrame: number
  frame: ReplaySpriteFrame | null
  texture: Texture | null
  radius: number
  mode: ReplayCrowdRenderMode | null
}

export function createPixiReplaySpriteState(): PixiReplaySpriteState {
  return {
    type: '',
    direction: '',
    clip: '',
    animationFrame: -1,
    frame: null,
    texture: null,
    radius: -1,
    mode: null,
  }
}

export function syncPixiReplaySprite(
  sprite: Sprite,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  state: PixiReplaySpriteState,
  replayTimeMs: number,
  counters?: ReplayRenderCounters,
): boolean {
  const animated = hasReplayVisualClips(unit.type)
  const visualState = animated
    ? resolveReplayUnitVisualState(unit, replayTimeMs)
    : null
  const direction = visualState?.direction ?? unit.visual.facing
  const clip = visualState?.clip ?? 'idle'
  let frame = state.frame
  const frameNeedsResolution =
    state.type !== unit.type ||
    state.direction !== direction ||
    animated
  const resolvedFrame = frameNeedsResolution
    ? resolveReplaySprite(
        unit.type,
        direction,
        clip,
        visualState?.elapsedMs ?? 0,
      )
    : frame
  let changed = false
  if (
    state.type !== unit.type ||
    state.direction !== direction ||
    frame !== resolvedFrame
  ) {
    frame = resolvedFrame
    const animationChanged =
      state.frame?.clip !== frame?.clip ||
      state.animationFrame !== (frame?.animationFrame ?? -1)
    state.type = unit.type
    state.direction = direction
    state.clip = clip
    state.animationFrame = frame?.animationFrame ?? -1
    state.frame = frame
    state.texture = frame ? getReplayTexture(frame) : null
    changed = true
    if (animationChanged && counters) counters.animationFrameChanges++
  }
  state.clip = clip
  if (!frame) {
    if (sprite.visible) {
      sprite.visible = false
      changed = true
    }
    if (changed && counters) counters.spriteChanges++
    return false
  }
  const texture = state.texture
  if (!texture) {
    if (sprite.visible) sprite.visible = false
    return false
  }
  if (sprite.texture !== texture) {
    sprite.texture = texture
    changed = true
  }
  if (state.radius !== view.radius || state.mode !== view.mode) {
    const size =
      getSpriteDrawSize(unit.type, frame.assetType, view.radius, view.mode)
    sprite.y = getSpriteOffsetY(frame.assetType, view.mode)
    sprite.width = size
    sprite.height = size
    state.radius = view.radius
    state.mode = view.mode
    changed = true
  }
  if (!sprite.visible) {
    sprite.visible = true
    changed = true
  }
  if (changed && counters) counters.spriteChanges++
  return true
}

const textureCache = new WeakMap<ReplaySpriteFrame, Texture | null>()

function getReplayTexture(frame: ReplaySpriteFrame): Texture | null {
  if (textureCache.has(frame)) return textureCache.get(frame) ?? null
  const base = Texture.from(frame.src)
  if (frame.kind === 'png') {
    textureCache.set(frame, base)
    return base
  }
  const source = base.source
  const frameWidth = frame.kind === 'svg-strip' ? Math.max(1, source.width / frame.frameCount) : frame.sourceWidth
  const frameHeight = frame.kind === 'svg-strip' ? source.height : frame.sourceHeight
  const texture = source.width < frameWidth * (frame.frameIndex + 1) || source.height < frameHeight
    ? base
    : new Texture({ source, frame: new Rectangle(frame.frameIndex * frameWidth, 0, frameWidth, frameHeight) })
  textureCache.set(frame, texture)
  return texture
}

function getSpriteDrawSize(type: string, assetType: string, radius: number, mode: ReplayCrowdRenderMode): number {
  const visualScale = UNIT_VISUALS[assetType as keyof typeof UNIT_VISUALS]?.scale ??
    UNIT_VISUALS[type as keyof typeof UNIT_VISUALS]?.scale ??
    1
  const modeScale = mode === 'cluster' ? 1.25 : mode === 'compact' ? 2.05 : 3.05
  return Math.max(10, radius * modeScale * visualScale)
}

function getSpriteOffsetY(assetType: string, mode: ReplayCrowdRenderMode): number {
  if (mode === 'cluster') return 0
  return (UNIT_VISUALS[assetType as keyof typeof UNIT_VISUALS]?.yOffset ?? 0) * 0.35
}
