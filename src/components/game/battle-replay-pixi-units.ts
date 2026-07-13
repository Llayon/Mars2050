import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { OverlayState, ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from './battle-replay-density'
import type { PixiReplayScene, PixiUnitDisplay } from './battle-replay-pixi-scene-types'
import { getPixiReplaySpriteDraw } from './battle-replay-pixi-sprites'

const OVERLAY_HITBOX_ATTACKER = 0x22d3ee
const OVERLAY_HITBOX_DEFENDER = 0xfb7185
const OVERLAY_VELOCITY = 0xfef08a

export function syncPixiReplayUnits(
  scene: PixiReplayScene,
  units: ReplayUnit[],
  unitViews: Map<string, ReplayCrowdUnitView>,
  overlays: OverlayState
): void {
  const seen = new Set<string>()
  units.forEach(unit => {
    const view = unitViews.get(unit.id)
    if (!view) return
    seen.add(unit.id)
    updateUnitDisplay(getUnitDisplay(scene, unit.id), unit, view, overlays)
  })
  scene.units.forEach((display, id) => {
    if (!seen.has(id)) display.layer.visible = false
  })
}

function getUnitDisplay(scene: PixiReplayScene, id: string): PixiUnitDisplay {
  const cached = scene.units.get(id)
  if (cached) return cached
  const display = createUnitDisplay()
  scene.units.set(id, display)
  scene.unitLayer.addChild(display.layer)
  return display
}

function createUnitDisplay(): PixiUnitDisplay {
  const layer = new Container()
  const display: PixiUnitDisplay = {
    layer,
    base: new Graphics(),
    flash: new Graphics(),
    fallback: new Graphics(),
    sprite: new Sprite(Texture.EMPTY),
    ring: new Graphics(),
    label: createUnitText('#ffffff', 12, true),
    emp: createUnitText('#67e8f9', 10, true),
    air: createUnitText('#bae6fd', 10, true),
    hp: new Graphics(),
    hitbox: new Graphics(),
    velocity: new Graphics(),
  }
  display.sprite.anchor.set(0.5)
  layer.addChild(
    display.base,
    display.flash,
    display.fallback,
    display.sprite,
    display.ring,
    display.label,
    display.emp,
    display.air,
    display.hp,
    display.hitbox,
    display.velocity
  )
  return display
}

function updateUnitDisplay(display: PixiUnitDisplay, unit: ReplayUnit, view: ReplayCrowdUnitView, overlays: OverlayState) {
  display.layer.visible = true
  display.layer.alpha = unit.isDead ? 0.28 : unit.stealth ? 0.45 : 1
  display.layer.zIndex = view.y
  clearDisplay(display)

  const sprite = getPixiReplaySpriteDraw(unit, view)
  if (sprite) {
    drawTeamBase(display.base, unit, view)
    if (unit.flash > 0) drawFlashRing(display.flash, view.x, view.y, view.radius, unit.flash)
    display.sprite.visible = true
    display.sprite.texture = sprite.texture
    display.sprite.x = sprite.x
    display.sprite.y = sprite.y
    display.sprite.width = sprite.size
    display.sprite.height = sprite.size
    drawTeamRing(display.ring, unit, view)
  } else {
    drawFallback(display, unit, view)
  }

  syncStatusLabels(display, unit, view)
  if (view.mode === 'full' || (view.mode === 'compact' && shouldShowPriorityHp(unit))) {
    drawHpBar(display.hp, view.x, view.y - view.radius - 8, unit.hp, unit.maxHp)
  }
  drawUnitOverlays(display, unit, view, overlays)
}

function clearDisplay(display: PixiUnitDisplay): void {
  display.base.clear()
  display.flash.clear()
  display.fallback.clear()
  display.ring.clear()
  display.hp.clear()
  display.hitbox.clear()
  display.velocity.clear()
  display.sprite.visible = false
  display.label.visible = false
  display.emp.visible = false
  display.air.visible = false
}

function drawFallback(display: PixiUnitDisplay, unit: ReplayUnit, view: ReplayCrowdUnitView): void {
  const color = unit.flash > 0 ? 0xfacc15 : unit.team === 'attacker' ? 0x3b82f6 : 0xef4444
  if (view.mode === 'cluster') {
    display.fallback.circle(view.x, view.y, Math.max(3, view.radius * 0.34)).fill(color)
    return
  }
  const airTarget = unit.isFlying || unit.mobilityMode === 'air'
  display.fallback.circle(view.x, view.y, view.radius)
    .fill(color)
    .stroke({ width: airTarget ? 3 : 2, color: airTarget ? 0xe0f2fe : 0x0f172a })
  if (view.mode === 'full') {
    display.label.visible = true
    display.label.text = unitLabel(unit.type)
    display.label.x = view.x
    display.label.y = view.y + 4
  }
}

function syncStatusLabels(display: PixiUnitDisplay, unit: ReplayUnit, view: ReplayCrowdUnitView): void {
  if (view.mode === 'cluster') return
  if (unit.emp) {
    display.emp.visible = true
    display.emp.x = view.x
    display.emp.y = view.y - view.radius - 12
  }
  if (unit.mobilityMode === 'air') {
    display.air.visible = true
    display.air.x = view.x
    display.air.y = view.y + view.radius + 12
  }
}

function drawUnitOverlays(display: PixiUnitDisplay, unit: ReplayUnit, view: ReplayCrowdUnitView, overlays: OverlayState) {
  if (overlays.radius) {
    display.hitbox.circle(view.x, view.y, view.radius)
      .stroke({ width: 1, color: unit.team === 'attacker' ? OVERLAY_HITBOX_ATTACKER : OVERLAY_HITBOX_DEFENDER })
  }
  if (overlays.velocity && (unit.tX !== unit.sX || unit.tY !== unit.sY)) {
    drawLine(display.velocity, view.x, view.y, view.x + (unit.tX - unit.sX) * 0.4, view.y + (unit.tY - unit.sY) * 0.4, OVERLAY_VELOCITY, 2)
  }
}

function drawTeamBase(graphic: Graphics, unit: ReplayUnit, view: ReplayCrowdUnitView) {
  const markerRadius = getTeamMarkerRadius(view, view.mode === 'cluster' ? 0.42 : view.mode === 'compact' ? 0.62 : 0.86)
  graphic.ellipse(view.x, view.y + markerRadius * 0.42, markerRadius, Math.max(2, markerRadius * 0.38))
    .fill({ color: unit.team === 'attacker' ? 0x3b82f6 : 0xef4444, alpha: view.mode === 'cluster' ? 0.62 : 0.78 })
}

function drawTeamRing(graphic: Graphics, unit: ReplayUnit, view: ReplayCrowdUnitView) {
  const markerRadius = getTeamMarkerRadius(view, view.mode === 'cluster' ? 0.46 : view.mode === 'compact' ? 0.76 : 1.02)
  graphic.ellipse(view.x, view.y + markerRadius * 0.42, markerRadius, Math.max(2, markerRadius * 0.38))
    .stroke({ width: view.mode === 'cluster' ? 1 : view.mode === 'compact' ? 2 : 3, color: unit.team === 'attacker' ? 0x60a5fa : 0xf87171, alpha: view.mode === 'cluster' ? 0.76 : 0.92 })
}

function getTeamMarkerRadius(view: ReplayCrowdUnitView, scale: number): number {
  return Math.max(4, view.radius * scale)
}

function drawFlashRing(graphic: Graphics, x: number, y: number, radius: number, flash: number) {
  graphic.circle(x, y, Math.max(5, radius * 1.1)).stroke({ width: 2, color: 0xfacc15, alpha: Math.max(0, Math.min(1, flash)) })
}

function drawHpBar(graphic: Graphics, x: number, y: number, hp: number, maxHp: number) {
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)))
  graphic.rect(x - 12, y, 24, 4).fill(0x334155)
  graphic.rect(x - 12, y, 24 * ratio, 4).fill(ratio > 0.5 ? 0x4ade80 : 0xef4444)
}

function createUnitText(color: string, size: number, bold = false): Text {
  const label = new Text({ text: '', style: { fill: color, fontSize: size, fontWeight: bold ? '700' : '400', stroke: { color: '#0f172a', width: 3 } } })
  label.anchor.set(0.5)
  label.visible = false
  return label
}

function shouldShowPriorityHp(unit: ReplayUnit): boolean {
  return unit.hp / Math.max(1, unit.maxHp) <= 0.45 ||
    unit.emp ||
    unit.stealth ||
    unit.isFlying ||
    unit.mobilityMode === 'air'
}

function unitLabel(type: string): string {
  return type.split('_').map(part => part.charAt(0)).join('').slice(0, 3).toUpperCase()
}

function drawLine(graphic: Graphics, x1: number, y1: number, x2: number, y2: number, color: number, width: number, alpha = 1) {
  graphic.moveTo(x1, y1)
  graphic.lineTo(x2, y2)
  graphic.stroke({ width, color, alpha })
}
