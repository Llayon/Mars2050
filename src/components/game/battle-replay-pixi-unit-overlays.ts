import type { OverlayState, ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from './battle-replay-density'
import type { ReplayRenderCounters } from './battle-replay-profile'
import type { PixiUnitDisplay } from './battle-replay-pixi-scene-types'
import {
  acquirePixiUnitGraphic,
  releasePixiUnitGraphic,
  type PixiUnitOptionalPool,
} from './battle-replay-pixi-unit-pool'

const HITBOX_ATTACKER_STROKE = { width: 1, color: 0x22d3ee }
const HITBOX_DEFENDER_STROKE = { width: 1, color: 0xfb7185 }
const VELOCITY_STROKE = { width: 2, color: 0xfef08a, alpha: 1 }

export function syncPixiUnitOverlays(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  overlays: OverlayState,
  pool: PixiUnitOptionalPool,
  counters?: ReplayRenderCounters,
): void {
  syncHitbox(display, unit, view, overlays.radius, pool, counters)
  syncVelocity(display, unit, overlays.velocity, pool, counters)
}

function syncHitbox(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  visible: boolean,
  pool: PixiUnitOptionalPool,
  counters?: ReplayRenderCounters,
): void {
  const state = display.state.hitbox
  if (!visible) {
    if (display.hitbox) {
      releasePixiUnitGraphic(pool, display.hitbox)
      display.hitbox = null
      state.hasGeometry = false
    }
    state.visible = false
    return
  }
  const hitbox = display.hitbox ?? acquireOverlay(display, pool, 'hitbox')
  state.visible = true
  if (
    state.hasGeometry &&
    state.team === unit.team &&
    state.radius === view.radius
  ) return

  hitbox.clear()
  hitbox.circle(0, 0, view.radius)
    .stroke(
      unit.team === 'attacker'
        ? HITBOX_ATTACKER_STROKE
        : HITBOX_DEFENDER_STROKE,
    )
  state.hasGeometry = true
  state.team = unit.team
  state.radius = view.radius
  if (counters) counters.hitboxRebuilds++
}

function syncVelocity(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  overlayVisible: boolean,
  pool: PixiUnitOptionalPool,
  counters?: ReplayRenderCounters,
): void {
  const state = display.state.velocity
  const dx = unit.tX - unit.sX
  const dy = unit.tY - unit.sY
  const visible = overlayVisible && (dx !== 0 || dy !== 0)
  if (!visible) {
    if (display.velocity) {
      releasePixiUnitGraphic(pool, display.velocity)
      display.velocity = null
      state.hasGeometry = false
    }
    state.visible = false
    return
  }
  const velocity =
    display.velocity ?? acquireOverlay(display, pool, 'velocity')
  state.visible = true
  if (state.hasGeometry && state.dx === dx && state.dy === dy) return

  velocity.clear()
  velocity.moveTo(0, 0)
  velocity.lineTo(dx * 0.4, dy * 0.4)
  velocity.stroke(VELOCITY_STROKE)
  state.hasGeometry = true
  state.dx = dx
  state.dy = dy
  if (counters) counters.velocityRebuilds++
}

function acquireOverlay(
  display: PixiUnitDisplay,
  pool: PixiUnitOptionalPool,
  key: 'hitbox' | 'velocity',
) {
  const graphic = acquirePixiUnitGraphic(pool)
  display.layer.addChild(graphic)
  display[key] = graphic
  return graphic
}
