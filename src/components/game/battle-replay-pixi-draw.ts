import { Graphics } from 'pixi.js'
import type { ReplayFrameState } from './battle-replay-runtime'
import { FLOAT_MS, HAZARD_MS, PROJECTILE_MS } from './battle-replay-canvas-types'
import type { ReplayCrowdClusterView } from './battle-replay-density'
import {
  selectReplayFloatingTextsInto,
  type ReplayRenderBudget,
} from './battle-replay-quality'
import type {
  PixiClusterDisplay,
  PixiReplayScene,
} from './battle-replay-pixi-scene-types'
import { getSceneGraphic, getSceneText, hideSceneGraphics, hideSceneTexts, setSceneText } from './battle-replay-pixi-scene'
import { syncPixiReplayUnits } from './battle-replay-pixi-units'
import type { ReplayRenderProfiler } from './battle-replay-profile'

const OVERLAY_TARGET_LINE = 0xff1f1f
const EMPTY_PROJECTILES: ReplayFrameState['projectiles'] = []
const CLUSTER_ATTACKER_FILL = { color: 0x3b82f6, alpha: 0.18 }
const CLUSTER_ATTACKER_STROKE = {
  width: 2,
  color: 0x93c5fd,
  alpha: 0.68,
}
const CLUSTER_DEFENDER_FILL = { color: 0xef4444, alpha: 0.18 }
const CLUSTER_DEFENDER_STROKE = {
  width: 2,
  color: 0xfca5a5,
  alpha: 0.68,
}
const lineStyleCache =
  new Map<number, { width: number; color: number; alpha: number }>()
const hazardColorCache = new Map<string, number>()
const hexColorCache = new Map<string, number>()

export function drawPixiReplay(
  scene: PixiReplayScene,
  state: ReplayFrameState,
  renderBudget: ReplayRenderBudget,
  profiler?: ReplayRenderProfiler,
) {
  scene.renderFrame++
  const progress = ease(state.progress)
  const crowdStartedAt = profiler?.now() ?? 0
  const crowdPlan = scene.crowdWorkspace.update(state.unitList, progress)
  if (profiler) {
    profiler.recordCrowdPlan(profiler.now() - crowdStartedAt)
  }

  let effectsStartedAt = profiler?.now() ?? 0
  syncHazards(scene, state.hazards)
  syncCrowdClusters(scene, crowdPlan.clusters)
  syncProjectiles(scene, state.projectiles)
  if (profiler) {
    profiler.recordEffects(profiler.now() - effectsStartedAt)
  }
  const unitsStartedAt = profiler?.now() ?? 0
  syncPixiReplayUnits(
    scene,
    state.unitList,
    crowdPlan.units,
    state.overlays,
    renderBudget,
    state.replayTimeMs,
    profiler?.frameCounters,
  )
  if (profiler) {
    profiler.recordUnitSync(profiler.now() - unitsStartedAt)
    effectsStartedAt = profiler.now()
  }
  syncTargetLines(
    scene,
    state.overlays.targets ? state.projectiles : EMPTY_PROJECTILES,
  )
  syncFloatingTexts(scene, selectReplayFloatingTextsInto(
    state.texts,
    renderBudget,
    scene.selectedTexts,
    scene.floatingTextBuckets,
  ))
  if (profiler) {
    profiler.recordEffects(profiler.now() - effectsStartedAt)
  }
}

function syncHazards(scene: PixiReplayScene, hazards: ReplayFrameState['hazards']): void {
  for (let index = 0; index < hazards.length; index++) {
    const hazard = hazards[index]
    const alpha = Math.max(0, 1 - hazard.age / HAZARD_MS)
    const graphic = getSceneGraphic(scene.hazards, scene.hazardLayer, index)
    graphic.alpha = 0.28 * alpha
    graphic.circle(hazard.x, hazard.y, hazard.radius)
      .fill(parseHazardColor(hazard.color))
  }
  hideSceneGraphics(scene.hazards, hazards.length)
}

function syncCrowdClusters(scene: PixiReplayScene, clusters: ReplayCrowdClusterView[]): void {
  for (let index = 0; index < clusters.length; index++) {
    const cluster = clusters[index]
    const display = scene.clusters.get(cluster.key) ??
      createClusterGraphic(scene, cluster.key)
    display.renderFrame = scene.renderFrame
    display.graphic.visible = true
    display.graphic.clear()
    drawCrowdCluster(display.graphic, cluster)
  }
  for (let index = 0; index < scene.clusterDisplays.length; index++) {
    const display = scene.clusterDisplays[index]
    if (display.renderFrame !== scene.renderFrame) {
      display.graphic.visible = false
    }
  }
}

function syncProjectiles(scene: PixiReplayScene, projectiles: ReplayFrameState['projectiles']): void {
  for (let index = 0; index < projectiles.length; index++) {
    const projectile = projectiles[index]
    const t = Math.min(1, projectile.age / PROJECTILE_MS)
    const x = lerp(projectile.x1, projectile.x2, t)
    const y = lerp(projectile.y1, projectile.y2, t)
    const graphic = getSceneGraphic(scene.projectiles, scene.projectileLayer, index)
    const color = parseHexColor(projectile.color)
    drawLine(
      graphic,
      lerp(projectile.x1, projectile.x2, Math.max(0, t - 0.18)),
      lerp(projectile.y1, projectile.y2, Math.max(0, t - 0.18)),
      x,
      y,
      color,
      2
    )
    graphic.circle(x, y, 3).fill(color)
  }
  hideSceneGraphics(scene.projectiles, projectiles.length)
}

function syncTargetLines(scene: PixiReplayScene, projectiles: ReplayFrameState['projectiles']): void {
  for (let index = 0; index < projectiles.length; index++) {
    const projectile = projectiles[index]
    const graphic = getSceneGraphic(scene.targetLines, scene.targetLayer, index)
    drawLine(graphic, projectile.x1, projectile.y1, projectile.x2, projectile.y2, OVERLAY_TARGET_LINE, 2)
  }
  hideSceneGraphics(scene.targetLines, projectiles.length)
}

function syncFloatingTexts(scene: PixiReplayScene, texts: ReplayFrameState['texts']): void {
  for (let index = 0; index < texts.length; index++) {
    const text = texts[index]
    const alpha = Math.max(0, 1 - text.age / FLOAT_MS)
    const label = getSceneText(scene.texts, scene.textLayer, index)
    setSceneText(label, text.text, text.x, text.y - text.age * 0.035, text.color, 13, true, alpha)
  }
  hideSceneTexts(scene.texts, texts.length)
}

function createClusterGraphic(
  scene: PixiReplayScene,
  key: string,
): PixiClusterDisplay {
  const graphic = new Graphics()
  const display = { graphic, renderFrame: 0 }
  scene.clusters.set(key, display)
  scene.clusterDisplays.push(display)
  scene.clusterLayer.addChild(graphic)
  return display
}

function drawCrowdCluster(graphic: Graphics, cluster: ReplayCrowdClusterView): void {
  const attacker = cluster.team === 'attacker'
  graphic.circle(cluster.x, cluster.y, cluster.radius)
    .fill(attacker ? CLUSTER_ATTACKER_FILL : CLUSTER_DEFENDER_FILL)
  graphic.circle(cluster.x, cluster.y, cluster.radius)
    .stroke(attacker ? CLUSTER_ATTACKER_STROKE : CLUSTER_DEFENDER_STROKE)
}

function parseHazardColor(template: string): number {
  const cached = hazardColorCache.get(template)
  if (cached !== undefined) return cached
  const match = template.match(/rgba\((\d+),(\d+),(\d+),ALPHA\)/)
  const color = match
    ? (Number(match[1]) << 16) + (Number(match[2]) << 8) + Number(match[3])
    : 0xf97316
  hazardColorCache.set(template, color)
  return color
}

function parseHexColor(color: string): number {
  const cached = hexColorCache.get(color)
  if (cached !== undefined) return cached
  const parsed = color.startsWith('#')
    ? Number.parseInt(color.slice(1), 16)
    : 0xffffff
  hexColorCache.set(color, parsed)
  return parsed
}

function drawLine(graphic: Graphics, x1: number, y1: number, x2: number, y2: number, color: number, width: number) {
  graphic.moveTo(x1, y1)
  graphic.lineTo(x2, y2)
  const key = color * 8 + width
  let style = lineStyleCache.get(key)
  if (!style) {
    style = { width, color, alpha: 1 }
    lineStyleCache.set(key, style)
  }
  graphic.stroke(style)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function ease(t: number) {
  return t * (2 - t)
}
