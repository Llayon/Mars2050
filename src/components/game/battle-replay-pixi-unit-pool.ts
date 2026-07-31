import { Container, Graphics, Text } from 'pixi.js'

export interface PixiUnitOptionalPool {
  storage: Container
  graphics: Graphics[]
  texts: Text[]
  allocatedGraphics: number
  allocatedTexts: number
  activeGraphics: number
  activeTexts: number
}

export function createPixiUnitOptionalPool(
  storage: Container,
): PixiUnitOptionalPool {
  return {
    storage,
    graphics: [],
    texts: [],
    allocatedGraphics: 0,
    allocatedTexts: 0,
    activeGraphics: 0,
    activeTexts: 0,
  }
}

export function acquirePixiUnitGraphic(
  pool: PixiUnitOptionalPool,
): Graphics {
  const cached = pool.graphics.pop()
  const graphic = cached ?? new Graphics()
  if (!cached) pool.allocatedGraphics++
  if (graphic.parent) graphic.removeFromParent()
  pool.activeGraphics++
  graphic.alpha = 1
  graphic.visible = true
  return graphic
}

export function releasePixiUnitGraphic(
  pool: PixiUnitOptionalPool,
  graphic: Graphics,
): void {
  graphic.clear()
  graphic.visible = false
  pool.storage.addChild(graphic)
  pool.graphics.push(graphic)
  pool.activeGraphics = Math.max(0, pool.activeGraphics - 1)
}

export function acquirePixiUnitText(
  pool: PixiUnitOptionalPool,
  color: string,
  size: number,
  bold = false,
): Text {
  const cached = pool.texts.pop()
  const label = cached ?? createUnitText()
  if (!cached) pool.allocatedTexts++
  if (label.parent) label.removeFromParent()
  pool.activeTexts++
  label.alpha = 1
  label.visible = true
  label.style.fill = color
  label.style.fontSize = size
  label.style.fontWeight = bold ? '700' : '400'
  return label
}

export function releasePixiUnitText(
  pool: PixiUnitOptionalPool,
  label: Text,
): void {
  label.text = ''
  label.visible = false
  pool.storage.addChild(label)
  pool.texts.push(label)
  pool.activeTexts = Math.max(0, pool.activeTexts - 1)
}

function createUnitText(): Text {
  const label = new Text({
    text: '',
    style: {
      fill: '#ffffff',
      fontSize: 12,
      fontWeight: '400',
      stroke: { color: '#0f172a', width: 3 },
    },
  })
  label.anchor.set(0.5)
  label.label = 'replay-unit-optional'
  return label
}
