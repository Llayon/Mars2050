import { getDir } from '@/domains/combat/combat.utils'
import { UNIT_VISUALS } from './battle-replay-visuals'
import type { ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdRenderMode, ReplayCrowdUnitView } from './battle-replay-density'
import { REPLAY_SPRITE_DIRECTIONS, SPRITE_DIRS, getReplayVisualAsset } from './battle-replay-visual-registry'

type ReplaySpriteKind = 'png' | 'svg-strip' | 'atlas'

export interface ReplaySpriteFrame {
  src: string
  assetType: string
  kind: ReplaySpriteKind
  frameIndex: number
  frameCount: number
  sourceWidth: number
  sourceHeight: number
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

export function resolveReplaySprite(type: string, direction: string): ReplaySpriteFrame | null {
  const resolved = getReplayVisualAsset(type)
  if (!resolved) return null
  const { assetType, asset } = resolved
  const dir = normalizeDirection(direction)
  if (asset.kind === 'png') {
    return {
      src: `${asset.path}/${dir}.png`,
      assetType,
      kind: 'png',
      frameIndex: 0,
      frameCount: 1,
      sourceWidth: 128,
      sourceHeight: 128,
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
    }
  }

  if (asset.kind === 'atlas') {
    return {
      src: asset.path.replace(/\.json$/, '.png'),
      assetType,
      kind: 'atlas',
      frameIndex: Math.max(0, ATLAS_IDLE_FRAME_ORDER.indexOf(dir)),
      frameCount: ATLAS_IDLE_FRAME_ORDER.length,
      sourceWidth: asset.sourceWidth ?? 128,
      sourceHeight: asset.sourceHeight ?? 128,
    }
  }

  return null
}

export function getReplaySpriteDirection(unit: ReplayUnit): string {
  const dx = unit.tX - unit.sX
  const dy = unit.tY - unit.sY
  if (Math.hypot(dx, dy) > 0.1) return normalizeDirection(getDir(dx, dy))
  return unit.team === 'attacker' ? 'north' : 'south'
}

export function drawReplayUnitSprite(
  ctx: CanvasRenderingContext2D,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView
): boolean {
  const sprite = resolveReplaySprite(unit.type, getReplaySpriteDirection(unit))
  if (!sprite) return false
  const image = loadReplayImage(sprite.src)
  if (!image) return false

  const size = getSpriteDrawSize(unit.type, sprite.assetType, view.radius, view.mode)
  const offsetY = getSpriteOffsetY(sprite.assetType, view.mode)
  const x = view.x - size / 2
  const y = view.y - size / 2 + offsetY

  drawTeamBase(ctx, unit, view)
  if (unit.flash > 0) drawFlashRing(ctx, view.x, view.y, view.radius, unit.flash)

  if (sprite.kind === 'png') {
    ctx.drawImage(image, x, y, size, size)
    drawTeamRing(ctx, unit, view)
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
  drawTeamRing(ctx, unit, view)
  return true
}

function normalizeDirection(direction: string): string {
  return SPRITE_DIRS.includes(direction) || ATLAS_IDLE_FRAME_ORDER.includes(direction) ? direction : 'south'
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

function drawTeamBase(ctx: CanvasRenderingContext2D, unit: ReplayUnit, view: ReplayCrowdUnitView) {
  const radiusScale = view.mode === 'cluster' ? 0.42 : view.mode === 'compact' ? 0.62 : 0.86
  const markerRadius = Math.max(4, view.radius * radiusScale)
  ctx.save()
  ctx.globalAlpha *= view.mode === 'cluster' ? 0.62 : 0.78
  ctx.fillStyle = unit.team === 'attacker' ? '#3b82f6' : '#ef4444'
  ctx.beginPath()
  ctx.ellipse(view.x, view.y + markerRadius * 0.42, markerRadius, Math.max(2, markerRadius * 0.38), 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawTeamRing(ctx: CanvasRenderingContext2D, unit: ReplayUnit, view: ReplayCrowdUnitView) {
  const radiusScale = view.mode === 'cluster' ? 0.46 : view.mode === 'compact' ? 0.76 : 1.02
  const markerRadius = Math.max(4, view.radius * radiusScale)
  ctx.save()
  ctx.globalAlpha *= view.mode === 'cluster' ? 0.76 : 0.92
  ctx.strokeStyle = unit.team === 'attacker' ? '#60a5fa' : '#f87171'
  ctx.lineWidth = view.mode === 'cluster' ? 1 : view.mode === 'compact' ? 2 : 3
  ctx.beginPath()
  ctx.ellipse(view.x, view.y + markerRadius * 0.42, markerRadius, Math.max(2, markerRadius * 0.38), 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
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
