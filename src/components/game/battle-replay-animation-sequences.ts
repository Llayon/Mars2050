import { Texture } from 'pixi.js'
import type { UnitTypeKey } from '@/domains/combat/combat.types'
import { UNIT_VISUALS } from './battle-replay-visuals'
import { SPRITE_DIRS } from './battle-replay-visual-registry'
import type { SpriteState } from './battle-replay-units'

export function addVisualAnimationAssets(toLoad: string[]): void {
  for (const visual of Object.values(UNIT_VISUALS)) {
    for (const animation of Object.values(visual.animations ?? {})) {
      for (const dir of SPRITE_DIRS) {
        for (let frame = 0; frame < animation.frameCount; frame++) {
          toLoad.push(getAnimationFramePath(animation.path, dir, frame))
        }
      }
    }
  }
}

export function getVisualAnimationTexture(sprite: SpriteState, globalTime: number): Texture | null {
  if (sprite.act !== 'walk' || !sprite.dir) return null

  const animation = UNIT_VISUALS[sprite.type as UnitTypeKey]?.animations?.walk
  if (!animation) return null

  const fps = animation.fps ?? 8
  const frame = Math.floor(globalTime / (1000 / fps)) % animation.frameCount
  return Texture.from(getAnimationFramePath(animation.path, sprite.dir, frame))
}

function getAnimationFramePath(basePath: string, dir: string, frame: number): string {
  return `${basePath}/${dir}/frame_${String(frame).padStart(3, '0')}.png`
}
