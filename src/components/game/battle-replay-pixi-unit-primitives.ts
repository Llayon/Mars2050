import type { ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from './battle-replay-density'
import type { ReplayRenderCounters } from './battle-replay-profile'
import type { PixiUnitDisplay } from './battle-replay-pixi-scene-types'
import {
  acquirePixiUnitGraphic,
  releasePixiUnitGraphic,
  type PixiUnitOptionalPool,
} from './battle-replay-pixi-unit-pool'

const FALLBACK_GROUND_STROKE = { width: 2, color: 0x0f172a }
const FALLBACK_AIR_STROKE = { width: 3, color: 0xe0f2fe }
const FLASH_STROKE = { width: 2, color: 0xfacc15 }

export function syncPixiFallback(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  hasSprite: boolean,
  pool: PixiUnitOptionalPool,
  counters?: ReplayRenderCounters,
): void {
  const state = display.state.fallback
  if (hasSprite) {
    if (display.fallback) {
      releasePixiUnitGraphic(pool, display.fallback)
      display.fallback = null
      state.hasGeometry = false
    }
    return
  }
  const fallback = display.fallback ?? acquireFallback(display, pool)

  const airTarget = unit.isFlying || unit.mobilityMode === 'air'
  const flashing = unit.flash > 0
  if (
    !state.hasGeometry ||
    state.team !== unit.team ||
    state.radius !== view.radius ||
    state.mode !== view.mode ||
    state.airTarget !== airTarget ||
    state.flashing !== flashing
  ) {
    const color = flashing
      ? 0xfacc15
      : unit.team === 'attacker' ? 0x3b82f6 : 0xef4444
    fallback.clear()
    if (view.mode === 'cluster') {
      fallback.circle(0, 0, Math.max(3, view.radius * 0.34))
        .fill(color)
    } else {
      fallback.circle(0, 0, view.radius)
        .fill(color)
        .stroke(
          airTarget ? FALLBACK_AIR_STROKE : FALLBACK_GROUND_STROKE,
        )
    }
    state.hasGeometry = true
    state.team = unit.team
    state.radius = view.radius
    state.mode = view.mode
    state.airTarget = airTarget
    state.flashing = flashing
    if (counters) counters.fallbackRebuilds++
  }
}

export function syncPixiFlash(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  hasSprite: boolean,
  pool: PixiUnitOptionalPool,
  counters?: ReplayRenderCounters,
): void {
  const state = display.state.flash
  const visible = hasSprite && unit.flash > 0
  if (!visible) {
    if (display.flash) {
      releasePixiUnitGraphic(pool, display.flash)
      display.flash = null
      state.hasGeometry = false
      state.alpha = -1
    }
    state.visible = false
    return
  }
  const flash = display.flash ?? acquireFlash(display, pool)
  state.visible = true

  if (!state.hasGeometry || state.radius !== view.radius) {
    flash.clear()
    flash.circle(0, 0, Math.max(5, view.radius * 1.1))
      .stroke(FLASH_STROKE)
    state.hasGeometry = true
    state.radius = view.radius
    if (counters) counters.flashRebuilds++
  }
  const alpha = Math.max(0, Math.min(1, unit.flash))
  if (state.alpha !== alpha) {
    state.alpha = alpha
    flash.alpha = alpha
  }
}

export function syncPixiHp(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  counters?: ReplayRenderCounters,
): void {
  const state = display.state.hp
  const visible =
    view.mode === 'full' ||
    (view.mode === 'compact' && shouldShowPriorityHp(unit))
  let changed = false

  if (state.visible !== visible) {
    state.visible = visible
    display.hpBackground.visible = visible
    display.hpFill.visible = visible
    changed = true
  }
  if (!visible) {
    if (changed && counters) counters.hpRebuilds++
    return
  }

  const y = Math.max(2 - view.y, -view.radius - 8)
  if (state.y !== y) {
    state.y = y
    display.hpBackground.y = y
    display.hpFill.y = y
    changed = true
  }
  const ratio = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)))
  if (state.ratio !== ratio) {
    state.ratio = ratio
    display.hpFill.width = 24 * ratio
    changed = true
  }
  if (state.team !== unit.team) {
    state.team = unit.team
    display.hpFill.tint = unit.team === 'attacker' ? 0x22c55e : 0xef4444
    changed = true
  }
  if (changed && counters) counters.hpRebuilds++
}

function shouldShowPriorityHp(unit: ReplayUnit): boolean {
  return unit.hp / Math.max(1, unit.maxHp) <= 0.45 ||
    unit.emp ||
    unit.stealth ||
    unit.isFlying ||
    unit.mobilityMode === 'air'
}

function acquireFallback(
  display: PixiUnitDisplay,
  pool: PixiUnitOptionalPool,
) {
  const graphic = acquirePixiUnitGraphic(pool)
  display.layer.addChildAt(
    graphic,
    display.layer.getChildIndex(display.sprite),
  )
  display.fallback = graphic
  return graphic
}

function acquireFlash(
  display: PixiUnitDisplay,
  pool: PixiUnitOptionalPool,
) {
  const graphic = acquirePixiUnitGraphic(pool)
  display.layer.addChildAt(graphic, 0)
  display.flash = graphic
  return graphic
}
