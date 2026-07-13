import { Container, Graphics, Text } from 'pixi.js'
import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { Obstacle } from '@/domains/combat/combat.types'
import type { PixiReplayScene } from './battle-replay-pixi-scene-types'

export function createPixiReplayScene(root: Container, obstacles: Obstacle[]): PixiReplayScene {
  const fieldLayer = new Container()
  const hazardLayer = new Container()
  const clusterLayer = new Container()
  const projectileLayer = new Container()
  const unitLayer = new Container()
  const targetLayer = new Container()
  const textLayer = new Container()
  unitLayer.sortableChildren = true
  root.addChild(fieldLayer, hazardLayer, clusterLayer, projectileLayer, unitLayer, targetLayer, textLayer)
  drawStaticBattlefield(fieldLayer, obstacles)

  return {
    root,
    fieldLayer,
    hazardLayer,
    clusterLayer,
    projectileLayer,
    unitLayer,
    targetLayer,
    textLayer,
    hazards: [],
    clusters: new Map(),
    projectiles: [],
    targetLines: [],
    texts: [],
    units: new Map(),
  }
}

export function getSceneGraphic(pool: Graphics[], layer: Container, index: number): Graphics {
  const graphic = pool[index] ?? new Graphics()
  if (!pool[index]) {
    pool[index] = graphic
    layer.addChild(graphic)
  }
  graphic.visible = true
  graphic.clear()
  return graphic
}

export function hideSceneGraphics(pool: Graphics[], usedCount: number): void {
  for (let index = usedCount; index < pool.length; index++) {
    pool[index].visible = false
  }
}

export function getSceneText(pool: Text[], layer: Container, index: number): Text {
  const label = pool[index] ?? createSceneText()
  if (!pool[index]) {
    pool[index] = label
    layer.addChild(label)
  }
  label.visible = true
  return label
}

export function hideSceneTexts(pool: Text[], usedCount: number): void {
  for (let index = usedCount; index < pool.length; index++) {
    pool[index].visible = false
  }
}

export function setSceneText(
  label: Text,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
  bold = false,
  alpha = 1
): void {
  label.text = text
  label.x = x
  label.y = y
  label.alpha = alpha
  label.zIndex = 5000
  label.style = {
    fill: color,
    fontSize: size,
    fontWeight: bold ? '700' : '400',
    stroke: { color: '#0f172a', width: 3 },
  }
}

function drawStaticBattlefield(layer: Container, obstacles: Obstacle[]) {
  const field = new Graphics()
  field.rect(0, 0, FIELD_WIDTH, FIELD_HEIGHT).fill(0x17172a)
  field.rect(0, 0, FIELD_WIDTH, FIELD_HEIGHT / 2).fill({ color: 0xef4444, alpha: 0.08 })
  field.rect(0, FIELD_HEIGHT / 2, FIELD_WIDTH, FIELD_HEIGHT / 2).fill({ color: 0x3b82f6, alpha: 0.08 })
  for (let y = 0; y <= FIELD_HEIGHT; y += 80) drawLine(field, 0, y, FIELD_WIDTH, y, 0x94a3b8, 1, 0.12)
  for (let x = 0; x <= FIELD_WIDTH; x += 80) drawLine(field, x, 0, x, FIELD_HEIGHT, 0x94a3b8, 1, 0.12)
  layer.addChild(field)

  obstacles.forEach(obstacle => {
    const graphic = new Graphics()
    graphic.circle(obstacle.x, obstacle.y, obstacle.radius).fill(0x5c4033).stroke({ width: 3, color: 0x3e2723 })
    layer.addChild(graphic)
  })
}

function createSceneText(): Text {
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
  return label
}

function drawLine(graphic: Graphics, x1: number, y1: number, x2: number, y2: number, color: number, width: number, alpha = 1) {
  graphic.moveTo(x1, y1)
  graphic.lineTo(x2, y2)
  graphic.stroke({ width, color, alpha })
}
