import { Container, Graphics, Text } from 'pixi.js'
import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { Obstacle } from '@/domains/combat/combat.types'
import type { FloatingText, HazardFx, OverlayState, Projectile, ReplayUnit } from './battle-replay-canvas-types'
import { FLOAT_MS, HAZARD_MS, PROJECTILE_MS } from './battle-replay-canvas-types'
import { buildReplayCrowdRenderPlan, type ReplayCrowdClusterView, type ReplayCrowdUnitView } from './battle-replay-density'
import { drawPixiUnitSprite } from './battle-replay-pixi-sprites'

const OVERLAY_HITBOX_ATTACKER = 0x22d3ee
const OVERLAY_HITBOX_DEFENDER = 0xfb7185
const OVERLAY_VELOCITY = 0xfef08a
const OVERLAY_TARGET_LINE = 0xff1f1f

export function drawPixiReplay(root: Container, state: {
  units: Record<string, ReplayUnit>
  hazards: HazardFx[]
  projectiles: Projectile[]
  texts: FloatingText[]
  overlays: OverlayState
  progress: number
}, obstacles: Obstacle[]) {
  destroyChildren(root)
  const progress = ease(state.progress)
  const unitList = Object.values(state.units)
  const crowdPlan = buildReplayCrowdRenderPlan(unitList, progress)
  const unitViews = new Map(crowdPlan.units.map(unit => [unit.id, unit]))

  root.addChild(drawBattlefield(obstacles, state.hazards))
  crowdPlan.clusters.forEach(cluster => root.addChild(drawCrowdCluster(cluster)))
  state.projectiles.forEach(projectile => root.addChild(drawProjectile(projectile)))
  unitList.forEach(unit => {
    const view = unitViews.get(unit.id)
    if (view) root.addChild(drawUnit(unit, view, state.overlays))
  })
  if (state.overlays.targets) state.projectiles.forEach(projectile => root.addChild(drawTargetLine(projectile)))
  state.texts.forEach(text => root.addChild(drawFloatingText(text)))
}

function drawBattlefield(obstacles: Obstacle[], hazards: HazardFx[]): Container {
  const layer = new Container()
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

  hazards.forEach(hazard => {
    const alpha = Math.max(0, 1 - hazard.age / HAZARD_MS)
    const graphic = new Graphics()
    const color = parseHazardColor(hazard.color)
    graphic.circle(hazard.x, hazard.y, hazard.radius).fill({ color, alpha: 0.28 * alpha })
    layer.addChild(graphic)
    layer.addChild(drawText(hazard.label, hazard.x, hazard.y, '#e2e8f0', 12))
  })
  return layer
}

function drawUnit(unit: ReplayUnit, view: ReplayCrowdUnitView, overlays: OverlayState): Container {
  const layer = new Container()
  layer.alpha = unit.isDead ? 0.28 : unit.stealth ? 0.45 : 1
  layer.zIndex = view.y
  const spriteDrawn = drawPixiUnitSprite(layer, unit, view)

  if (!spriteDrawn) {
    const fallback = new Graphics()
    const color = unit.flash > 0 ? 0xfacc15 : unit.team === 'attacker' ? 0x3b82f6 : 0xef4444
    if (view.mode === 'cluster') {
      fallback.circle(view.x, view.y, Math.max(3, view.radius * 0.34)).fill(color)
    } else {
      fallback.circle(view.x, view.y, view.radius)
        .fill(color)
        .stroke({ width: unit.isFlying || unit.mobilityMode === 'air' ? 3 : 2, color: unit.isFlying || unit.mobilityMode === 'air' ? 0xe0f2fe : 0x0f172a })
      if (view.mode === 'full') layer.addChild(drawText(unitLabel(unit.type), view.x, view.y + 4, '#ffffff', 12, true))
    }
    layer.addChild(fallback)
  }

  if (view.mode !== 'cluster') {
    if (unit.emp) layer.addChild(drawText('EMP', view.x, view.y - view.radius - 12, '#67e8f9', 10, true))
    if (unit.mobilityMode === 'air') layer.addChild(drawText('AIR', view.x, view.y + view.radius + 12, '#bae6fd', 10, true))
  }
  if (view.mode === 'full' || (view.mode === 'compact' && shouldShowPriorityHp(unit))) {
    layer.addChild(drawHpBar(view.x, view.y - view.radius - 8, unit.hp, unit.maxHp))
  }
  drawUnitOverlays(layer, unit, view, overlays)
  return layer
}

function drawUnitOverlays(layer: Container, unit: ReplayUnit, view: ReplayCrowdUnitView, overlays: OverlayState) {
  if (overlays.radius) {
    const graphic = new Graphics()
    graphic.circle(view.x, view.y, view.radius).stroke({ width: 1, color: unit.team === 'attacker' ? OVERLAY_HITBOX_ATTACKER : OVERLAY_HITBOX_DEFENDER })
    layer.addChild(graphic)
  }
  if (overlays.velocity && (unit.tX !== unit.sX || unit.tY !== unit.sY)) {
    const graphic = new Graphics()
    drawLine(graphic, view.x, view.y, view.x + (unit.tX - unit.sX) * 0.4, view.y + (unit.tY - unit.sY) * 0.4, OVERLAY_VELOCITY, 2)
    layer.addChild(graphic)
  }
}

function drawCrowdCluster(cluster: ReplayCrowdClusterView): Graphics {
  const graphic = new Graphics()
  const fillColor = cluster.team === 'attacker' ? 0x3b82f6 : 0xef4444
  const strokeColor = cluster.team === 'attacker' ? 0x93c5fd : 0xfca5a5
  graphic.circle(cluster.x, cluster.y, cluster.radius).fill({ color: fillColor, alpha: 0.18 })
  graphic.circle(cluster.x, cluster.y, cluster.radius).stroke({ width: 2, color: strokeColor, alpha: 0.68 })
  return graphic
}

function drawHpBar(x: number, y: number, hp: number, maxHp: number): Graphics {
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)))
  const graphic = new Graphics()
  graphic.rect(x - 12, y, 24, 4).fill(0x334155)
  graphic.rect(x - 12, y, 24 * ratio, 4).fill(ratio > 0.5 ? 0x4ade80 : 0xef4444)
  return graphic
}

function drawProjectile(projectile: Projectile): Graphics {
  const t = Math.min(1, projectile.age / PROJECTILE_MS)
  const x = lerp(projectile.x1, projectile.x2, t)
  const y = lerp(projectile.y1, projectile.y2, t)
  const graphic = new Graphics()
  const color = parseHexColor(projectile.color)
  drawLine(graphic, lerp(projectile.x1, projectile.x2, Math.max(0, t - 0.18)), lerp(projectile.y1, projectile.y2, Math.max(0, t - 0.18)), x, y, color, 2)
  graphic.circle(x, y, 3).fill(color)
  return graphic
}

function drawTargetLine(projectile: Projectile): Graphics {
  const graphic = new Graphics()
  drawLine(graphic, projectile.x1, projectile.y1, projectile.x2, projectile.y2, OVERLAY_TARGET_LINE, 2)
  return graphic
}

function drawFloatingText(text: FloatingText): Text {
  const alpha = Math.max(0, 1 - text.age / FLOAT_MS)
  const label = drawText(text.text, text.x, text.y - text.age * 0.035, text.color, 13, true)
  label.alpha = alpha
  return label
}

function drawText(text: string, x: number, y: number, color: string, size: number, bold = false): Text {
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
  label.x = x
  label.y = y
  label.zIndex = 5000
  return label
}

function shouldShowPriorityHp(unit: ReplayUnit): boolean {
  return unit.hp / Math.max(1, unit.maxHp) <= 0.45 ||
    unit.emp ||
    unit.stealth ||
    unit.isFlying ||
    unit.mobilityMode === 'air'
}

function destroyChildren(root: Container) {
  root.removeChildren().forEach(child => {
    child.destroy({ children: true, texture: false, textureSource: false })
  })
}

function unitLabel(type: string): string {
  return type.split('_').map(part => part.charAt(0)).join('').slice(0, 3).toUpperCase()
}

function parseHazardColor(template: string): number {
  const match = template.match(/rgba\((\d+),(\d+),(\d+),ALPHA\)/)
  if (!match) return 0xf97316
  return (Number(match[1]) << 16) + (Number(match[2]) << 8) + Number(match[3])
}

function parseHexColor(color: string): number {
  if (!color.startsWith('#')) return 0xffffff
  return Number.parseInt(color.slice(1), 16)
}

function drawLine(graphic: Graphics, x1: number, y1: number, x2: number, y2: number, color: number, width: number, alpha = 1) {
  graphic.moveTo(x1, y1)
  graphic.lineTo(x2, y2)
  graphic.stroke({ width, color, alpha })
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function ease(t: number) {
  return t * (2 - t)
}
