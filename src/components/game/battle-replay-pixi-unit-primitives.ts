import type { ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from './battle-replay-density'
import type { ReplayRenderCounters } from './battle-replay-profile'
import type { PixiUnitDisplay } from './battle-replay-pixi-scene-types'

const FALLBACK_GROUND_STROKE = { width: 2, color: 0x0f172a }
const FALLBACK_AIR_STROKE = { width: 3, color: 0xe0f2fe }
const FLASH_STROKE = { width: 2, color: 0xfacc15 }
const unitLabelCache = new Map<string, string>()

export function syncPixiFallback(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  hasSprite: boolean,
  counters?: ReplayRenderCounters,
): void {
  if (display.fallback.visible === hasSprite) {
    display.fallback.visible = !hasSprite
  }
  const state = display.state.fallback
  if (hasSprite) return

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
    display.fallback.clear()
    if (view.mode === 'cluster') {
      display.fallback.circle(0, 0, Math.max(3, view.radius * 0.34))
        .fill(color)
    } else {
      display.fallback.circle(0, 0, view.radius)
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
  counters?: ReplayRenderCounters,
): void {
  const state = display.state.flash
  const visible = hasSprite && unit.flash > 0
  if (state.visible !== visible) {
    state.visible = visible
    display.flash.visible = visible
  }
  if (!visible) return

  if (!state.hasGeometry || state.radius !== view.radius) {
    display.flash.clear()
    display.flash.circle(0, 0, Math.max(5, view.radius * 1.1))
      .stroke(FLASH_STROKE)
    state.hasGeometry = true
    state.radius = view.radius
    if (counters) counters.flashRebuilds++
  }
  const alpha = Math.max(0, Math.min(1, unit.flash))
  if (state.alpha !== alpha) {
    state.alpha = alpha
    display.flash.alpha = alpha
  }
}

export function syncPixiStatusLabels(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  hasSprite: boolean,
  counters?: ReplayRenderCounters,
): void {
  const state = display.state.status
  const labelVisible = !hasSprite && view.mode === 'full'
  const empVisible = view.mode !== 'cluster' && unit.emp
  const airVisible =
    view.mode !== 'cluster' && unit.mobilityMode === 'air'
  let changed = false

  if (state.labelVisible !== labelVisible) {
    state.labelVisible = labelVisible
    display.label.visible = labelVisible
    changed = true
  }
  if (labelVisible && state.labelType !== unit.type) {
    state.labelType = unit.type
    display.label.text = unitLabel(unit.type)
    changed = true
  }
  if (state.empVisible !== empVisible) {
    state.empVisible = empVisible
    display.emp.visible = empVisible
    changed = true
  }
  if (state.airVisible !== airVisible) {
    state.airVisible = airVisible
    display.air.visible = airVisible
    changed = true
  }
  if (state.radius !== view.radius) {
    state.radius = view.radius
    display.emp.position.set(0, -view.radius - 12)
    display.air.position.set(0, view.radius + 12)
    changed = true
  }
  if (changed && counters) counters.statusChanges++
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

function unitLabel(type: string): string {
  const cached = unitLabelCache.get(type)
  if (cached) return cached
  const label = type.split('_').map(part => part.charAt(0))
    .join('').slice(0, 3).toUpperCase()
  unitLabelCache.set(type, label)
  return label
}
