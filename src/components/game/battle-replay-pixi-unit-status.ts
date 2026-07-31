import type { ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from './battle-replay-density'
import type { ReplayRenderCounters } from './battle-replay-profile'
import type { PixiUnitDisplay } from './battle-replay-pixi-scene-types'
import {
  acquirePixiUnitText,
  releasePixiUnitText,
  type PixiUnitOptionalPool,
} from './battle-replay-pixi-unit-pool'

const unitLabelCache = new Map<string, string>()

export function syncPixiStatusLabels(
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  hasSprite: boolean,
  pool: PixiUnitOptionalPool,
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
    toggleUnitLabel(display, pool, labelVisible)
    if (!labelVisible) state.labelType = ''
    changed = true
  }
  if (labelVisible && state.labelType !== unit.type) {
    state.labelType = unit.type
    if (display.label) display.label.text = unitLabel(unit.type)
    changed = true
  }
  if (state.empVisible !== empVisible) {
    state.empVisible = empVisible
    toggleStatusLabel(
      display,
      pool,
      'emp',
      empVisible,
      'EMP',
      '#67e8f9',
      -view.radius - 12,
    )
    changed = true
  }
  if (state.airVisible !== airVisible) {
    state.airVisible = airVisible
    toggleStatusLabel(
      display,
      pool,
      'air',
      airVisible,
      'AIR',
      '#bae6fd',
      view.radius + 12,
    )
    changed = true
  }
  if (state.radius !== view.radius) {
    state.radius = view.radius
    display.emp?.position.set(0, -view.radius - 12)
    display.air?.position.set(0, view.radius + 12)
    changed = true
  }
  if (changed && counters) counters.statusChanges++
}

function toggleUnitLabel(
  display: PixiUnitDisplay,
  pool: PixiUnitOptionalPool,
  visible: boolean,
): void {
  if (visible) {
    display.label = acquireStatusText(
      display,
      pool,
      '#ffffff',
      12,
    )
    display.label.position.set(0, 4)
  } else if (display.label) {
    releasePixiUnitText(pool, display.label)
    display.label = null
  }
}

function toggleStatusLabel(
  display: PixiUnitDisplay,
  pool: PixiUnitOptionalPool,
  key: 'emp' | 'air',
  visible: boolean,
  text: string,
  color: string,
  y: number,
): void {
  if (visible) {
    const label = acquireStatusText(display, pool, color, 10)
    label.text = text
    label.position.set(0, y)
    display[key] = label
  } else if (display[key]) {
    releasePixiUnitText(pool, display[key])
    display[key] = null
  }
}

function acquireStatusText(
  display: PixiUnitDisplay,
  pool: PixiUnitOptionalPool,
  color: string,
  size: number,
) {
  const label = acquirePixiUnitText(pool, color, size, true)
  display.layer.addChildAt(
    label,
    display.layer.getChildIndex(display.hpBackground),
  )
  return label
}

function unitLabel(type: string): string {
  const cached = unitLabelCache.get(type)
  if (cached) return cached
  const label = type.split('_').map(part => part.charAt(0))
    .join('').slice(0, 3).toUpperCase()
  unitLabelCache.set(type, label)
  return label
}
