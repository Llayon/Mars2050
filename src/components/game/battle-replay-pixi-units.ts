import type { OverlayState, ReplayUnit } from './battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from './battle-replay-density'
import type { PixiReplayScene, PixiUnitDisplay } from './battle-replay-pixi-scene-types'
import { syncPixiReplaySprite } from './battle-replay-pixi-sprites'
import {
  shouldRenderReplayUnit,
  type ReplayRenderBudget,
} from './battle-replay-quality'
import type { ReplayRenderCounters } from './battle-replay-profile'
import {
  createPixiUnitDisplay,
  releasePixiUnitDisplayOptionals,
} from './battle-replay-pixi-unit-display'
import {
  syncPixiFallback,
  syncPixiFlash,
  syncPixiHp,
} from './battle-replay-pixi-unit-primitives'
import { syncPixiUnitOverlays } from './battle-replay-pixi-unit-overlays'
import { syncPixiStatusLabels } from './battle-replay-pixi-unit-status'

export function syncPixiReplayUnits(
  scene: PixiReplayScene,
  units: ReplayUnit[],
  unitViews: ReplayCrowdUnitView[],
  overlays: OverlayState,
  renderBudget: ReplayRenderBudget,
  replayTimeMs: number,
  counters?: ReplayRenderCounters,
): void {
  for (let index = 0; index < units.length; index++) {
    const unit = units[index]
    const view = unitViews[index]
    if (!view || !shouldRenderReplayUnit(unit, view, renderBudget)) continue
    const display = getUnitDisplay(scene, unit.id)
    display.renderFrame = scene.renderFrame
    if (counters) counters.visibleUnitUpdates++
    updateUnitDisplay(
      scene,
      display,
      unit,
      view,
      overlays,
      replayTimeMs,
      counters,
    )
  }
  for (let index = 0; index < scene.unitDisplays.length; index++) {
    const display = scene.unitDisplays[index]
    if (
      display.renderFrame !== scene.renderFrame &&
      display.layer.visible
    ) {
      display.layer.visible = false
      releasePixiUnitDisplayOptionals(
        display,
        scene.unitOptionalPool,
      )
    }
  }
}

function getUnitDisplay(scene: PixiReplayScene, id: string): PixiUnitDisplay {
  const cached = scene.units.get(id)
  if (cached) return cached
  const display = createPixiUnitDisplay()
  scene.units.set(id, display)
  scene.unitDisplays.push(display)
  scene.unitLayer.addChild(display.layer)
  return display
}

function updateUnitDisplay(
  scene: PixiReplayScene,
  display: PixiUnitDisplay,
  unit: ReplayUnit,
  view: ReplayCrowdUnitView,
  overlays: OverlayState,
  replayTimeMs: number,
  counters?: ReplayRenderCounters,
): void {
  if (!display.layer.visible) display.layer.visible = true
  const alpha = unit.isDead ? 0.28 : unit.stealth ? 0.45 : 1
  if (display.layer.alpha !== alpha) display.layer.alpha = alpha
  if (display.layer.x !== view.x || display.layer.y !== view.y) {
    display.layer.position.set(view.x, view.y)
    if (counters) counters.positionChanges++
  }
  if (display.layer.zIndex !== view.y) {
    display.layer.zIndex = view.y
    if (counters) counters.depthChanges++
  }

  const hasSprite = syncPixiReplaySprite(
    display.sprite,
    unit,
    view,
    display.state.sprite,
    replayTimeMs,
    counters,
  )
  syncPixiFallback(
    display,
    unit,
    view,
    hasSprite,
    scene.unitOptionalPool,
    counters,
  )
  syncPixiFlash(
    display,
    unit,
    view,
    hasSprite,
    scene.unitOptionalPool,
    counters,
  )
  syncPixiStatusLabels(
    display,
    unit,
    view,
    hasSprite,
    scene.unitOptionalPool,
    counters,
  )
  syncPixiHp(display, unit, view, counters)
  syncPixiUnitOverlays(
    display,
    unit,
    view,
    overlays,
    scene.unitOptionalPool,
    counters,
  )
}
