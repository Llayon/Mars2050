import type { OverlayState, ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from './battle-replay-density'
import type { ReplayRenderCounters } from './battle-replay-profile'
import type { PixiUnitDisplay } from './battle-replay-pixi-scene-types'

const HITBOX_ATTACKER_STROKE = { width: 1, color: 0x22d3ee }
const HITBOX_DEFENDER_STROKE = { width: 1, color: 0xfb7185 }
const VELOCITY_STROKE = { width: 2, color: 0xfef08a, alpha: 1 }

export function syncPixiUnitOverlays(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  overlays: OverlayState,
  counters?: ReplayRenderCounters,
): void {
  syncHitbox(display, unit, view, overlays.radius, counters)
  syncVelocity(display, unit, overlays.velocity, counters)
}

function syncHitbox(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  visible: boolean,
  counters?: ReplayRenderCounters,
): void {
  const state = display.state.hitbox
  if (state.visible !== visible) {
    state.visible = visible
    display.hitbox.visible = visible
  }
  if (!visible) return
  if (
    state.hasGeometry &&
    state.team === unit.team &&
    state.radius === view.radius
  ) return

  display.hitbox.clear()
  display.hitbox.circle(0, 0, view.radius)
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
  counters?: ReplayRenderCounters,
): void {
  const state = display.state.velocity
  const dx = unit.tX - unit.sX
  const dy = unit.tY - unit.sY
  const visible = overlayVisible && (dx !== 0 || dy !== 0)
  if (state.visible !== visible) {
    state.visible = visible
    display.velocity.visible = visible
  }
  if (!visible) return
  if (state.hasGeometry && state.dx === dx && state.dy === dy) return

  display.velocity.clear()
  display.velocity.moveTo(0, 0)
  display.velocity.lineTo(dx * 0.4, dy * 0.4)
  display.velocity.stroke(VELOCITY_STROKE)
  state.hasGeometry = true
  state.dx = dx
  state.dy = dy
  if (counters) counters.velocityRebuilds++
}
