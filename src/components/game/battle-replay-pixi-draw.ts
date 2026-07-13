import { Graphics } from 'pixi.js'
import type { ReplayFrameState } from './battle-replay-runtime'
import { FLOAT_MS, HAZARD_MS, PROJECTILE_MS } from './battle-replay-canvas-types'
import { buildReplayCrowdRenderPlan, type ReplayCrowdClusterView } from './battle-replay-density'
import type { PixiReplayScene } from './battle-replay-pixi-scene-types'
import { getSceneGraphic, getSceneText, hideSceneGraphics, hideSceneTexts, setSceneText } from './battle-replay-pixi-scene'
import { syncPixiReplayUnits } from './battle-replay-pixi-units'

const OVERLAY_TARGET_LINE = 0xff1f1f

export function drawPixiReplay(scene: PixiReplayScene, state: ReplayFrameState) {
  const progress = ease(state.progress)
  const unitList = Object.values(state.units)
  const crowdPlan = buildReplayCrowdRenderPlan(unitList, progress)
  const unitViews = new Map(crowdPlan.units.map(unit => [unit.id, unit]))

  syncHazards(scene, state.hazards)
  syncCrowdClusters(scene, crowdPlan.clusters)
  syncProjectiles(scene, state.projectiles)
  syncPixiReplayUnits(scene, unitList, unitViews, state.overlays)
  syncTargetLines(scene, state.overlays.targets ? state.projectiles : [])
  syncFloatingTexts(scene, state.texts)
}

function syncHazards(scene: PixiReplayScene, hazards: ReplayFrameState['hazards']): void {
  hazards.forEach((hazard, index) => {
    const alpha = Math.max(0, 1 - hazard.age / HAZARD_MS)
    const graphic = getSceneGraphic(scene.hazards, scene.hazardLayer, index)
    graphic.circle(hazard.x, hazard.y, hazard.radius).fill({ color: parseHazardColor(hazard.color), alpha: 0.28 * alpha })
  })
  hideSceneGraphics(scene.hazards, hazards.length)
}

function syncCrowdClusters(scene: PixiReplayScene, clusters: ReplayCrowdClusterView[]): void {
  const seen = new Set<string>()
  clusters.forEach(cluster => {
    seen.add(cluster.key)
    const graphic = scene.clusters.get(cluster.key) ?? createClusterGraphic(scene, cluster.key)
    graphic.visible = true
    graphic.clear()
    drawCrowdCluster(graphic, cluster)
  })
  scene.clusters.forEach((graphic, key) => {
    if (!seen.has(key)) graphic.visible = false
  })
}

function syncProjectiles(scene: PixiReplayScene, projectiles: ReplayFrameState['projectiles']): void {
  projectiles.forEach((projectile, index) => {
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
  })
  hideSceneGraphics(scene.projectiles, projectiles.length)
}

function syncTargetLines(scene: PixiReplayScene, projectiles: ReplayFrameState['projectiles']): void {
  projectiles.forEach((projectile, index) => {
    const graphic = getSceneGraphic(scene.targetLines, scene.targetLayer, index)
    drawLine(graphic, projectile.x1, projectile.y1, projectile.x2, projectile.y2, OVERLAY_TARGET_LINE, 2)
  })
  hideSceneGraphics(scene.targetLines, projectiles.length)
}

function syncFloatingTexts(scene: PixiReplayScene, texts: ReplayFrameState['texts']): void {
  texts.forEach((text, index) => {
    const alpha = Math.max(0, 1 - text.age / FLOAT_MS)
    const label = getSceneText(scene.texts, scene.textLayer, index)
    setSceneText(label, text.text, text.x, text.y - text.age * 0.035, text.color, 13, true, alpha)
  })
  hideSceneTexts(scene.texts, texts.length)
}

function createClusterGraphic(scene: PixiReplayScene, key: string): Graphics {
  const graphic = new Graphics()
  scene.clusters.set(key, graphic)
  scene.clusterLayer.addChild(graphic)
  return graphic
}

function drawCrowdCluster(graphic: Graphics, cluster: ReplayCrowdClusterView): void {
  const fillColor = cluster.team === 'attacker' ? 0x3b82f6 : 0xef4444
  const strokeColor = cluster.team === 'attacker' ? 0x93c5fd : 0xfca5a5
  graphic.circle(cluster.x, cluster.y, cluster.radius).fill({ color: fillColor, alpha: 0.18 })
  graphic.circle(cluster.x, cluster.y, cluster.radius).stroke({ width: 2, color: strokeColor, alpha: 0.68 })
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
