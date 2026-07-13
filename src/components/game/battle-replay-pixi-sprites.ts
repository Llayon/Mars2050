import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import type { ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdRenderMode, ReplayCrowdUnitView } from './battle-replay-density'
import { getReplaySpriteDirection, resolveReplaySprite, type ReplaySpriteFrame } from './battle-replay-sprites'
import { UNIT_VISUALS } from './battle-replay-visuals'

export interface PixiReplaySpriteDraw {
  texture: Texture
  x: number
  y: number
  size: number
}

export function drawPixiUnitSprite(layer: Container, unit: ReplayUnit, view: ReplayCrowdUnitView): boolean {
  const spriteDraw = getPixiReplaySpriteDraw(unit, view)
  if (!spriteDraw) return false

  layer.addChild(drawTeamBase(unit, view))
  if (unit.flash > 0) layer.addChild(drawFlashRing(view.x, view.y, view.radius, unit.flash))
  const sprite = new Sprite(spriteDraw.texture)
  sprite.anchor.set(0.5)
  sprite.x = spriteDraw.x
  sprite.y = spriteDraw.y
  sprite.width = spriteDraw.size
  sprite.height = spriteDraw.size
  layer.addChild(sprite)
  layer.addChild(drawTeamRing(unit, view))
  return true
}

export function getPixiReplaySpriteDraw(unit: ReplayUnit, view: ReplayCrowdUnitView): PixiReplaySpriteDraw | null {
  const frame = resolveReplaySprite(unit.type, getReplaySpriteDirection(unit))
  if (!frame) return null
  const texture = getReplayTexture(frame)
  if (!texture) return null
  const size = getSpriteDrawSize(unit.type, frame.assetType, view.radius, view.mode)
  return {
    texture,
    x: view.x,
    y: view.y + getSpriteOffsetY(frame.assetType, view.mode),
    size,
  }
}

const textureCache = new Map<string, Texture | null>()

function getReplayTexture(frame: ReplaySpriteFrame): Texture | null {
  const key = `${frame.src}:${frame.kind}:${frame.frameIndex}:${frame.frameCount}`
  if (textureCache.has(key)) return textureCache.get(key) ?? null
  const base = Texture.from(frame.src)
  if (frame.kind === 'png') {
    textureCache.set(key, base)
    return base
  }
  const source = base.source
  const frameWidth = frame.kind === 'svg-strip' ? Math.max(1, source.width / frame.frameCount) : frame.sourceWidth
  const frameHeight = frame.kind === 'svg-strip' ? source.height : frame.sourceHeight
  const texture = source.width < frameWidth * (frame.frameIndex + 1) || source.height < frameHeight
    ? base
    : new Texture({ source, frame: new Rectangle(frame.frameIndex * frameWidth, 0, frameWidth, frameHeight) })
  textureCache.set(key, texture)
  return texture
}

function drawTeamBase(unit: ReplayUnit, view: ReplayCrowdUnitView): Graphics {
  const radiusScale = view.mode === 'cluster' ? 0.42 : view.mode === 'compact' ? 0.62 : 0.86
  const markerRadius = Math.max(4, view.radius * radiusScale)
  const graphic = new Graphics()
  graphic.ellipse(view.x, view.y + markerRadius * 0.42, markerRadius, Math.max(2, markerRadius * 0.38))
    .fill({ color: unit.team === 'attacker' ? 0x3b82f6 : 0xef4444, alpha: view.mode === 'cluster' ? 0.62 : 0.78 })
  return graphic
}

function drawTeamRing(unit: ReplayUnit, view: ReplayCrowdUnitView): Graphics {
  const radiusScale = view.mode === 'cluster' ? 0.46 : view.mode === 'compact' ? 0.76 : 1.02
  const markerRadius = Math.max(4, view.radius * radiusScale)
  const graphic = new Graphics()
  graphic.ellipse(view.x, view.y + markerRadius * 0.42, markerRadius, Math.max(2, markerRadius * 0.38))
    .stroke({ width: view.mode === 'cluster' ? 1 : view.mode === 'compact' ? 2 : 3, color: unit.team === 'attacker' ? 0x60a5fa : 0xf87171, alpha: view.mode === 'cluster' ? 0.76 : 0.92 })
  return graphic
}

function drawFlashRing(x: number, y: number, radius: number, flash: number): Graphics {
  const graphic = new Graphics()
  graphic.circle(x, y, Math.max(5, radius * 1.1)).stroke({ width: 2, color: 0xfacc15, alpha: Math.max(0, Math.min(1, flash)) })
  return graphic
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
