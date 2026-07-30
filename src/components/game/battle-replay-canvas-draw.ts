import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { Obstacle } from '@/domains/combat/combat.types'
import type {
  FloatingText,
  HazardFx,
  OverlayState,
  Projectile,
  ReplayUnit,
} from './battle-replay-canvas-types'
import { FLOAT_MS, HAZARD_MS, PROJECTILE_MS } from './battle-replay-canvas-types'
import { buildReplayCrowdRenderPlan, type ReplayCrowdClusterView, type ReplayCrowdUnitView } from './battle-replay-density'
import {
  selectReplayFloatingTexts,
  shouldRenderReplayUnit,
  type ReplayRenderBudget,
} from './battle-replay-quality'
import type { ReplayFrameState } from './battle-replay-runtime'
import { drawReplayUnitSprite } from './battle-replay-sprites'

const OVERLAY_HITBOX_ATTACKER = '#22d3ee'
const OVERLAY_HITBOX_DEFENDER = '#fb7185'
const OVERLAY_VELOCITY = '#fef08a'
const OVERLAY_TARGET_LINE = '#ff1f1f'

export function drawReplay(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  state: ReplayFrameState,
  obstacles: Obstacle[],
  renderBudget: ReplayRenderBudget,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT)
  const easedProgress = ease(state.progress)
  const unitList = Object.values(state.units)
  const crowdPlan = buildReplayCrowdRenderPlan(unitList, easedProgress)
  const unitViews = new Map(crowdPlan.units.map(unit => [unit.id, unit]))
  drawBattlefield(ctx, obstacles, state.hazards)
  crowdPlan.clusters.forEach(cluster => drawCrowdCluster(ctx, cluster))
  state.projectiles.forEach(projectile => drawProjectile(ctx, projectile))
  unitList.forEach(unit => {
    const view = unitViews.get(unit.id)
    if (view && shouldRenderReplayUnit(unit, view, renderBudget)) {
      drawUnit(ctx, unit, view, state.overlays)
    }
  })
  if (state.overlays.targets) {
    state.projectiles.forEach(projectile => drawTargetLine(ctx, projectile))
  }
  selectReplayFloatingTexts(state.texts, renderBudget)
    .forEach(text => drawFloatingText(ctx, text))
}

function drawBattlefield(ctx: CanvasRenderingContext2D, obstacles: Obstacle[], hazards: HazardFx[]) {
  ctx.fillStyle = '#17172a'
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT)
  ctx.fillStyle = 'rgba(239,68,68,0.08)'
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT / 2)
  ctx.fillStyle = 'rgba(59,130,246,0.08)'
  ctx.fillRect(0, FIELD_HEIGHT / 2, FIELD_WIDTH, FIELD_HEIGHT / 2)
  ctx.strokeStyle = 'rgba(148,163,184,0.12)'
  ctx.lineWidth = 1
  for (let y = 0; y <= FIELD_HEIGHT; y += 80) drawLine(ctx, 0, y, FIELD_WIDTH, y)
  for (let x = 0; x <= FIELD_WIDTH; x += 80) drawLine(ctx, x, 0, x, FIELD_HEIGHT)
  obstacles.forEach(obstacle => {
    ctx.fillStyle = '#5c4033'
    ctx.strokeStyle = '#3e2723'
    ctx.lineWidth = 3
    drawCircle(ctx, obstacle.x, obstacle.y, obstacle.radius, true, true)
  })
  hazards.forEach(hazard => {
    const alpha = Math.max(0, 1 - hazard.age / HAZARD_MS)
    ctx.fillStyle = hazard.color.replace('ALPHA', String(0.28 * alpha))
    drawCircle(ctx, hazard.x, hazard.y, hazard.radius, true, false)
    drawText(ctx, hazard.label, hazard.x, hazard.y, '#e2e8f0', 12)
  })
}

function drawUnit(ctx: CanvasRenderingContext2D, unit: ReplayUnit, view: ReplayCrowdUnitView, overlays: OverlayState) {
  const { x, y, radius, mode } = view
  const color = unit.team === 'attacker' ? '#3b82f6' : '#ef4444'
  ctx.save()
  ctx.globalAlpha = unit.isDead ? 0.28 : unit.stealth ? 0.45 : 1
  ctx.fillStyle = unit.flash > 0 ? '#facc15' : color
  ctx.strokeStyle = unit.isFlying || unit.mobilityMode === 'air' ? '#e0f2fe' : '#0f172a'
  ctx.lineWidth = unit.isFlying || unit.mobilityMode === 'air' ? 3 : 2
  const spriteDrawn = drawReplayUnitSprite(ctx, unit, view)
  if (!spriteDrawn) {
    if (mode === 'cluster') {
      drawCircle(ctx, x, y, Math.max(3, radius * 0.34), true, false)
    } else {
      drawCircle(ctx, x, y, radius, true, true)
      if (mode === 'full') drawText(ctx, unitLabel(unit.type), x, y + 4, '#ffffff', 12, true)
    }
  }
  if (mode !== 'cluster') {
    if (unit.emp) drawText(ctx, 'EMP', x, y - radius - 12, '#67e8f9', 10, true)
    if (unit.mobilityMode === 'air') drawText(ctx, 'AIR', x, y + radius + 12, '#bae6fd', 10, true)
  }
  ctx.restore()
  if (mode === 'full' || (mode === 'compact' && shouldShowPriorityHp(unit))) {
    drawHpBar(ctx, x, Math.max(2, y - radius - 8), unit.hp, unit.maxHp, unit.team)
  }
  drawUnitOverlays(ctx, unit, x, y, radius, overlays)
}

function drawUnitOverlays(ctx: CanvasRenderingContext2D, unit: ReplayUnit, x: number, y: number, radius: number, overlays: OverlayState) {
  if (overlays.radius) {
    ctx.strokeStyle = unit.team === 'attacker' ? OVERLAY_HITBOX_ATTACKER : OVERLAY_HITBOX_DEFENDER
    ctx.lineWidth = 1
    drawCircle(ctx, x, y, radius, false, true)
  }
  if (overlays.velocity && (unit.tX !== unit.sX || unit.tY !== unit.sY)) {
    ctx.strokeStyle = OVERLAY_VELOCITY
    ctx.lineWidth = 2
    drawLine(ctx, x, y, x + (unit.tX - unit.sX) * 0.4, y + (unit.tY - unit.sY) * 0.4)
  }
}

function drawCrowdCluster(ctx: CanvasRenderingContext2D, cluster: ReplayCrowdClusterView) {
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.fillStyle = cluster.team === 'attacker' ? '#3b82f6' : '#ef4444'
  drawCircle(ctx, cluster.x, cluster.y, cluster.radius, true, false)
  ctx.globalAlpha = 0.68
  ctx.strokeStyle = cluster.team === 'attacker' ? '#93c5fd' : '#fca5a5'
  ctx.lineWidth = 2
  drawCircle(ctx, cluster.x, cluster.y, cluster.radius, false, true)
  ctx.restore()
}

function shouldShowPriorityHp(unit: ReplayUnit): boolean {
  return unit.hp / Math.max(1, unit.maxHp) <= 0.45 ||
    unit.emp ||
    unit.stealth ||
    unit.isFlying ||
    unit.mobilityMode === 'air'
}

function drawHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, maxHp: number, team: ReplayUnit['team']) {
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)))
  ctx.fillStyle = '#334155'
  ctx.fillRect(x - 12, y, 24, 4)
  ctx.fillStyle = team === 'attacker' ? '#22c55e' : '#ef4444'
  ctx.fillRect(x - 12, y, 24 * ratio, 4)
}

function drawProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile) {
  const t = Math.min(1, projectile.age / PROJECTILE_MS)
  const x = lerp(projectile.x1, projectile.x2, t)
  const y = lerp(projectile.y1, projectile.y2, t)
  ctx.strokeStyle = projectile.color
  ctx.lineWidth = 2
  drawLine(ctx, lerp(projectile.x1, projectile.x2, Math.max(0, t - 0.18)), lerp(projectile.y1, projectile.y2, Math.max(0, t - 0.18)), x, y)
  ctx.fillStyle = projectile.color
  drawCircle(ctx, x, y, 3, true, false)
}

function drawTargetLine(ctx: CanvasRenderingContext2D, projectile: Projectile) {
  ctx.strokeStyle = OVERLAY_TARGET_LINE
  ctx.lineWidth = 2
  drawLine(ctx, projectile.x1, projectile.y1, projectile.x2, projectile.y2)
}

function drawFloatingText(ctx: CanvasRenderingContext2D, text: FloatingText) {
  const alpha = Math.max(0, 1 - text.age / FLOAT_MS)
  drawText(ctx, text.text, text.x, text.y - text.age * 0.035, text.color, 13, true, alpha)
}

function unitLabel(type: string): string {
  return type.split('_').map(part => part.charAt(0)).join('').slice(0, 3).toUpperCase()
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function ease(t: number) {
  return t * (2 - t)
}

function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: boolean, stroke: boolean) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  if (fill) ctx.fill()
  if (stroke) ctx.stroke()
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number, bold = false, alpha = 1) {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.fillStyle = color
  ctx.font = `${bold ? '700 ' : ''}${size}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(15,23,42,0.85)'
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}
