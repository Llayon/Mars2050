import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { PixiUnitDisplay } from './battle-replay-pixi-scene-types'
import { createPixiUnitRenderState } from './battle-replay-pixi-unit-state'

export function createPixiUnitDisplay(): PixiUnitDisplay {
  const layer = new Container()
  const hpBackground = createHpSprite(0x334155)
  const hpFill = createHpSprite(0xffffff)
  const display: PixiUnitDisplay = {
    renderFrame: 0,
    layer,
    flash: new Graphics(),
    fallback: new Graphics(),
    sprite: new Sprite(Texture.EMPTY),
    label: createUnitText('', '#ffffff', 12, true),
    emp: createUnitText('', '#67e8f9', 10, true),
    air: createUnitText('', '#bae6fd', 10, true),
    hpBackground,
    hpFill,
    hitbox: new Graphics(),
    velocity: new Graphics(),
    state: createPixiUnitRenderState(),
  }
  display.sprite.anchor.set(0.5)
  display.flash.visible = false
  display.hitbox.visible = false
  display.velocity.visible = false
  display.label.position.set(0, 4)
  layer.addChild(
    display.flash,
    display.fallback,
    display.sprite,
    display.label,
    display.emp,
    display.air,
    display.hpBackground,
    display.hpFill,
    display.hitbox,
    display.velocity,
  )
  return display
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

function createUnitText(
  text: string,
  color: string,
  size: number,
  bold = false,
): Text {
  const label = new Text({
    text,
    style: {
      fill: color,
      fontSize: size,
      fontWeight: bold ? '700' : '400',
      stroke: { color: '#0f172a', width: 3 },
    },
  })
  label.anchor.set(0.5)
  label.visible = false
  return label
}
