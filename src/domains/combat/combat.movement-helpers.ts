import type { BattleAction } from './combat.actions'
import type { Obstacle, SimUnit } from './combat.sim.types'
import { getDistance } from './combat.utils'

export function getObstacleCorrection(
  unit: SimUnit,
  obstacles: Obstacle[],
  myRadius: number,
  effectiveSpeed: number
): { x: number; y: number } {
  let x = 0
  let y = 0

  for (const obs of obstacles) {
    const dist = getDistance(unit.x, unit.y, obs.x, obs.y)
    const minDist = myRadius + obs.radius
    if (dist > 0 && dist < minDist) {
      const overlap = minDist - dist
      const pushAngle = Math.atan2(unit.y - obs.y, unit.x - obs.x)
      const pushForce = Math.min(overlap * 2.5, Math.max(10, effectiveSpeed * 0.6))
      x += Math.cos(pushAngle) * pushForce
      y += Math.sin(pushAngle) * pushForce
    }
  }

  return { x, y }
}

export function emitStationaryMoveIfTurning(
  unit: SimUnit,
  target: SimUnit,
  actions: BattleAction[],
  angleDiff: number
): void {
  if (Math.abs(angleDiff) <= 0.2) return
  emitMove(unit, target, actions, unit.x, unit.y, angleDiff, false)
}

export function emitMove(
  unit: SimUnit,
  target: SimUnit,
  actions: BattleAction[],
  fromX: number,
  fromY: number,
  angleDiff: number,
  isWalking: boolean
): void {
  if (Math.hypot(unit.x - fromX, unit.y - fromY) <= 0.1 && Math.abs(angleDiff) <= 0.2) return

  const r = (v: number) => Math.round(v * 100) / 100
  actions.push({
    unitId: unit.id,
    type: 'move',
    targetId: target.id,
    fromX: r(fromX),
    fromY: r(fromY),
    toX: r(unit.x),
    toY: r(unit.y),
    facingAngle: r(unit.currentAngle),
    isWalking,
  })
}
