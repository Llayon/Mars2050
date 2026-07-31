import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { OverlayState, ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from './battle-replay-density'
import type { PixiReplayScene, PixiUnitDisplay } from './battle-replay-pixi-scene-types'
import { syncPixiReplaySprite } from './battle-replay-pixi-sprites'
import {
  shouldRenderReplayUnit,
  type ReplayRenderBudget,
} from './battle-replay-quality'

const OVERLAY_HITBOX_ATTACKER = 0x22d3ee
const OVERLAY_HITBOX_DEFENDER = 0xfb7185
const OVERLAY_VELOCITY = 0xfef08a
const FALLBACK_GROUND_STROKE = { width: 2, color: 0x0f172a }
const FALLBACK_AIR_STROKE = { width: 3, color: 0xe0f2fe }
const HITBOX_ATTACKER_STROKE = {
  width: 1,
  color: OVERLAY_HITBOX_ATTACKER,
}
const HITBOX_DEFENDER_STROKE = {
  width: 1,
  color: OVERLAY_HITBOX_DEFENDER,
}
const VELOCITY_STROKE = { width: 2, color: OVERLAY_VELOCITY, alpha: 1 }
const FLASH_STROKE = { width: 2, color: 0xfacc15 }
const unitLabelCache = new Map<string, string>()

export function syncPixiReplayUnits(
  scene: PixiReplayScene,
  units: ReplayUnit[],
  unitViews: ReplayCrowdUnitView[],
  overlays: OverlayState,
  renderBudget: ReplayRenderBudget,
): void {
  for (let index = 0; index < units.length; index++) {
    const unit = units[index]
    const view = unitViews[index]
    if (!view || !shouldRenderReplayUnit(unit, view, renderBudget)) continue
    const display = getUnitDisplay(scene, unit.id)
    display.renderFrame = scene.renderFrame
    updateUnitDisplay(display, unit, view, overlays)
  }
  for (let index = 0; index < scene.unitDisplays.length; index++) {
    const display = scene.unitDisplays[index]
    if (display.renderFrame !== scene.renderFrame) display.layer.visible = false
  }
}

function getUnitDisplay(scene: PixiReplayScene, id: string): PixiUnitDisplay {
  const cached = scene.units.get(id)
  if (cached) return cached
  const display = createUnitDisplay()
  scene.units.set(id, display)
  scene.unitDisplays.push(display)
  scene.unitLayer.addChild(display.layer)
  return display
}

function createUnitDisplay(): PixiUnitDisplay {
  const layer = new Container()
  const display: PixiUnitDisplay = {
    renderFrame: 0,
    layer,
    flash: new Graphics(),
    fallback: new Graphics(),
    sprite: new Sprite(Texture.EMPTY),
    label: createUnitText('#ffffff', 12, true),
    emp: createUnitText('#67e8f9', 10, true),
    air: createUnitText('#bae6fd', 10, true),
    hp: new Graphics(),
    hitbox: new Graphics(),
    velocity: new Graphics(),
  }
  display.sprite.anchor.set(0.5)
  layer.addChild(
    display.flash,
    display.fallback,
    display.sprite,
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

  if (syncPixiReplaySprite(display.sprite, unit, view)) {
    if (unit.flash > 0) drawFlashRing(display.flash, view.x, view.y, view.radius, unit.flash)
  } else {
    drawFallback(display, unit, view)
  }

  syncStatusLabels(display, unit, view)
  if (view.mode === 'full' || (view.mode === 'compact' && shouldShowPriorityHp(unit))) {
    drawHpBar(display.hp, view.x, Math.max(2, view.y - view.radius - 8), unit.hp, unit.maxHp, unit.team)
  }
  drawUnitOverlays(display, unit, view, overlays)
}

function clearDisplay(display: PixiUnitDisplay): void {
  display.flash.clear()
  display.fallback.clear()
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
    .stroke(airTarget ? FALLBACK_AIR_STROKE : FALLBACK_GROUND_STROKE)
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
      .stroke(unit.team === 'attacker'
        ? HITBOX_ATTACKER_STROKE
        : HITBOX_DEFENDER_STROKE)
  }
  if (overlays.velocity && (unit.tX !== unit.sX || unit.tY !== unit.sY)) {
    drawLine(
      display.velocity,
      view.x,
      view.y,
      view.x + (unit.tX - unit.sX) * 0.4,
      view.y + (unit.tY - unit.sY) * 0.4,
    )
  }
}

function drawFlashRing(graphic: Graphics, x: number, y: number, radius: number, flash: number) {
  graphic.alpha = Math.max(0, Math.min(1, flash))
  graphic.circle(x, y, Math.max(5, radius * 1.1)).stroke(FLASH_STROKE)
}

function drawHpBar(graphic: Graphics, x: number, y: number, hp: number, maxHp: number, team: ReplayUnit['team']) {
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)))
  graphic.rect(x - 12, y, 24, 4).fill(0x334155)
  graphic.rect(x - 12, y, 24 * ratio, 4).fill(team === 'attacker' ? 0x22c55e : 0xef4444)
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
  const cached = unitLabelCache.get(type)
  if (cached) return cached
  const label = type.split('_').map(part => part.charAt(0))
    .join('').slice(0, 3).toUpperCase()
  unitLabelCache.set(type, label)
  return label
}

function drawLine(
  graphic: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  graphic.moveTo(x1, y1)
  graphic.lineTo(x2, y2)
  graphic.stroke(VELOCITY_STROKE)
}
