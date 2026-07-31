import { Container, Sprite, Texture } from 'pixi.js'
import type { PixiUnitDisplay } from './battle-replay-pixi-scene-types'
import { createPixiUnitRenderState } from './battle-replay-pixi-unit-state'
import {
  releasePixiUnitGraphic,
  releasePixiUnitText,
  type PixiUnitOptionalPool,
} from './battle-replay-pixi-unit-pool'

export function createPixiUnitDisplay(): PixiUnitDisplay {
  const layer = new Container()
  const hpBackground = createHpSprite(0x334155)
  const hpFill = createHpSprite(0xffffff)
  const display: PixiUnitDisplay = {
    renderFrame: 0,
    layer,
    flash: null,
    fallback: null,
    sprite: new Sprite(Texture.EMPTY),
    label: null,
    emp: null,
    air: null,
    hpBackground,
    hpFill,
    hitbox: null,
    velocity: null,
    state: createPixiUnitRenderState(),
  }
  display.sprite.anchor.set(0.5)
  layer.addChild(
    display.sprite,
    display.hpBackground,
    display.hpFill,
  )
  return display
}

export function releasePixiUnitDisplayOptionals(
  display: PixiUnitDisplay,
  pool: PixiUnitOptionalPool,
): void {
  if (display.flash) releasePixiUnitGraphic(pool, display.flash)
  if (display.fallback) releasePixiUnitGraphic(pool, display.fallback)
  if (display.hitbox) releasePixiUnitGraphic(pool, display.hitbox)
  if (display.velocity) releasePixiUnitGraphic(pool, display.velocity)
  if (display.label) releasePixiUnitText(pool, display.label)
  if (display.emp) releasePixiUnitText(pool, display.emp)
  if (display.air) releasePixiUnitText(pool, display.air)
  display.flash = null
  display.fallback = null
  display.hitbox = null
  display.velocity = null
  display.label = null
  display.emp = null
  display.air = null
  resetOptionalState(display)
}

function createHpSprite(tint: number): Sprite {
  const sprite = new Sprite(Texture.WHITE)
  sprite.position.set(-12, 0)
  sprite.width = 24
  sprite.height = 4
  sprite.tint = tint
  sprite.visible = false
  return sprite
}

function resetOptionalState(display: PixiUnitDisplay): void {
  display.state.fallback.hasGeometry = false
  display.state.flash.hasGeometry = false
  display.state.flash.visible = false
  display.state.flash.alpha = -1
  display.state.hitbox.hasGeometry = false
  display.state.hitbox.visible = false
  display.state.velocity.hasGeometry = false
  display.state.velocity.visible = false
  display.state.status.labelVisible = false
  display.state.status.labelType = ''
  display.state.status.empVisible = false
  display.state.status.airVisible = false
  display.state.status.radius = -1
}
