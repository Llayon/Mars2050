import { Rectangle, Sprite, Texture } from 'pixi.js'
import type { ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdRenderMode, ReplayCrowdUnitView } from './battle-replay-density'
import { getReplaySpriteDirection, resolveReplaySprite, type ReplaySpriteFrame } from './battle-replay-sprites'
import { UNIT_VISUALS } from './battle-replay-visuals'

export function syncPixiReplaySprite(
  sprite: Sprite,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
): boolean {
  const frame = resolveReplaySprite(unit.type, getReplaySpriteDirection(unit))
  if (!frame) return false
  const texture = getReplayTexture(frame)
  if (!texture) return false
  const size = getSpriteDrawSize(unit.type, frame.assetType, view.radius, view.mode)
  sprite.visible = true
  sprite.texture = texture
  sprite.x = view.x
  sprite.y = view.y + getSpriteOffsetY(frame.assetType, view.mode)
  sprite.width = size
  sprite.height = size
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
