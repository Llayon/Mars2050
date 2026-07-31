import { getDir } from '@/domains/combat/combat.utils'
import { UNIT_VISUALS } from './battle-replay-visuals'
import type {
  ReplayUnit,
  ReplayVisualClip,
  ReplayVisualDirection,
} from './battle-replay-canvas-types'
import type { ReplayCrowdRenderMode, ReplayCrowdUnitView } from './battle-replay-density'
import { REPLAY_SPRITE_DIRECTIONS, SPRITE_DIRS, getReplayVisualAsset } from './battle-replay-visual-registry'
import {
  normalizeReplayVisualDirection,
  resolveReplayVisualClipFrame,
} from './battle-replay-visual-clips'
import { resolveReplayUnitVisualState } from './battle-replay-visual-state'

type ReplaySpriteKind = 'png' | 'svg-strip' | 'atlas'

export interface ReplaySpriteFrame {
  src: string
  assetType: string
  kind: ReplaySpriteKind
  frameIndex: number
  frameCount: number
  sourceWidth: number
  sourceHeight: number
  clip: ReplayVisualClip
  animationFrame: number
}

const ATLAS_IDLE_FRAME_ORDER = [
  'east',
  'north-east',
  'north-west',
  'north',
  'south-east',
  'south-west',
  'south',
  'west',
]

const imageCache = new Map<string, HTMLImageElement | 'missing'>()
const spriteFrameCache =
  new Map<string, Map<string, ReplaySpriteFrame | null>>()

export function resolveReplaySprite(
  type: string,
  direction: string,
  clip: ReplayVisualClip = 'idle',
  elapsedMs = 0,
): ReplaySpriteFrame | null {
  const dir = normalizeReplayVisualDirection(direction)
  const clipFrame = resolveReplayVisualClipFrame(
    type,
    clip,
    dir,
    elapsedMs,
  )
  const cacheKey =
    `${dir}:${clipFrame.clip}:${clipFrame.animationFrame}`
  let directionCache = spriteFrameCache.get(type)
  if (!directionCache) {
    directionCache = new Map()
    spriteFrameCache.set(type, directionCache)
  } else if (directionCache.has(cacheKey)) {
    return directionCache.get(cacheKey) ?? null
  }
  const frame = createReplaySpriteFrame(type, dir, clipFrame)
  directionCache.set(cacheKey, frame)
  return frame
}

function createReplaySpriteFrame(
  type: string,
  dir: ReplayVisualDirection,
  clipFrame: ReturnType<typeof resolveReplayVisualClipFrame>,
): ReplaySpriteFrame | null {
  const resolved = getReplayVisualAsset(type)
  if (!resolved) return null
  const { assetType, asset } = resolved
  if (asset.kind === 'png') {
    return {
      src: `${asset.path}/${dir}.png`,
      assetType,
      kind: 'png',
      frameIndex: 0,
      frameCount: 1,
      sourceWidth: 128,
      sourceHeight: 128,
      clip: clipFrame.clip,
      animationFrame: clipFrame.animationFrame,
    }
  }

  if (asset.kind === 'svg-strip') {
    return {
      src: asset.path,
      assetType,
      kind: 'svg-strip',
      frameIndex: Math.max(0, SPRITE_DIRS.indexOf(dir)),
      frameCount: asset.frameCount ?? REPLAY_SPRITE_DIRECTIONS.length,
      sourceWidth: asset.sourceWidth ?? 100,
      sourceHeight: asset.sourceHeight ?? 100,
      clip: clipFrame.clip,
      animationFrame: clipFrame.animationFrame,
    }
  }

  if (asset.kind === 'atlas') {
    return {
      src: asset.path.replace(/\.json$/, '.png'),
      assetType,
      kind: 'atlas',
      frameIndex: asset.clips
        ? clipFrame.atlasFrame
        : Math.max(0, ATLAS_IDLE_FRAME_ORDER.indexOf(dir)),
      frameCount: ATLAS_IDLE_FRAME_ORDER.length,
      sourceWidth: asset.sourceWidth ?? 128,
      sourceHeight: asset.sourceHeight ?? 128,
      clip: clipFrame.clip,
      animationFrame: clipFrame.animationFrame,
    }
  }

  return null
}

export function getReplaySpriteDirection(unit: ReplayUnit): string {
  const dx = unit.tX - unit.sX
  const dy = unit.tY - unit.sY
  if (Math.hypot(dx, dy) > 0.1) {
    return normalizeReplayVisualDirection(getDir(dx, dy))
  }
  return unit.visual.facing
}

export function drawReplayUnitSprite(
  ctx: CanvasRenderingContext2D,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  replayTimeMs: number,
): boolean {
  const visualState = resolveReplayUnitVisualState(unit, replayTimeMs)
  const sprite = resolveReplaySprite(
    unit.type,
    visualState.direction,
    visualState.clip,
    visualState.elapsedMs,
  )
  if (!sprite) return false
  const image = loadReplayImage(sprite.src)
  if (!image) return false

  const size = getSpriteDrawSize(unit.type, sprite.assetType, view.radius, view.mode)
  const offsetY = getSpriteOffsetY(sprite.assetType, view.mode)
  const x = view.x - size / 2
  const y = view.y - size / 2 + offsetY

  if (unit.flash > 0) drawFlashRing(ctx, view.x, view.y, view.radius, unit.flash)

  if (sprite.kind === 'png') {
    ctx.drawImage(image, x, y, size, size)
    return true
  }

  const frameWidth = sprite.kind === 'svg-strip'
    ? Math.max(1, image.naturalWidth / sprite.frameCount)
    : sprite.sourceWidth
  const frameHeight = sprite.kind === 'svg-strip' ? image.naturalHeight : sprite.sourceHeight
  ctx.drawImage(
    image,
    sprite.frameIndex * frameWidth,
    0,
    frameWidth,
    frameHeight,
    x,
    y,
    size,
    size
  )
  return true
}

function loadReplayImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src)
  if (cached === 'missing') return null
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null
  if (typeof Image === 'undefined') return null

  const image = new Image()
  image.onload = () => imageCache.set(src, image)
  image.onerror = () => imageCache.set(src, 'missing')
  image.src = src
  imageCache.set(src, image)
  return null
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

function drawFlashRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, flash: number) {
  ctx.save()
  ctx.globalAlpha *= Math.max(0, Math.min(1, flash))
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, Math.max(5, radius * 1.1), 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}
