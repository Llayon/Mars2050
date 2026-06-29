import type { SimUnit } from './combat.sim.types'
import { getEffectiveActionRange } from './combat.status'
import { getDistance, getSizeRadius } from './combat.utils'

export interface FormationCohesionForce {
  x: number
  y: number
}

export function getFormationCohesionForce(
  unit: SimUnit,
  targetPoint: { x: number; y: number },
  squadCx: number,
  squadCy: number,
  squadCount: number,
  distEdge: number,
  isNavigatingObstacle: boolean
): FormationCohesionForce {
  if (squadCount <= 1) return { x: 0, y: 0 }

  const isBug = unit.type.startsWith('alien_')
  const nearEngagement = distEdge <= getEffectiveActionRange(unit) + getEngagementCohesionBuffer(unit)
  const threshold = isBug ? 60 : (nearEngagement ? 36 : 14)
  const target = getFormationAnchor(unit, targetPoint, squadCx, squadCy, isBug)
  const distance = getDistance(unit.x, unit.y, target.x, target.y)

  if (distance <= threshold) return { x: 0, y: 0 }

  const angle = Math.atan2(target.y - unit.y, target.x - unit.x)
  const pull = unit.speed * getFormationPullMultiplier(isBug, nearEngagement, isNavigatingObstacle)

  return {
    x: Math.cos(angle) * pull,
    y: Math.sin(angle) * pull,
  }
}

function getFormationAnchor(
  unit: SimUnit,
  targetPoint: { x: number; y: number },
  squadCx: number,
  squadCy: number,
  isBug: boolean
): { x: number; y: number } {
  if (isBug || unit.offsetX === undefined || unit.offsetY === undefined || unit.initialAngle === undefined) {
    return { x: squadCx, y: squadCy }
  }

  const squadAngle = Math.atan2(targetPoint.y - squadCy, targetPoint.x - squadCx)
  const rotation = squadAngle - unit.initialAngle
  const rotatedOx = unit.offsetX * Math.cos(rotation) - unit.offsetY * Math.sin(rotation)
  const rotatedOy = unit.offsetX * Math.sin(rotation) + unit.offsetY * Math.cos(rotation)

  return { x: squadCx + rotatedOx, y: squadCy + rotatedOy }
}

function getFormationPullMultiplier(isBug: boolean, nearEngagement: boolean, isNavigatingObstacle: boolean): number {
  if (isNavigatingObstacle) return 0.1
  if (isBug) return 0.5
  return nearEngagement ? 0.18 : 0.75
}

function getEngagementCohesionBuffer(unit: SimUnit): number {
  return Math.max(70, getSizeRadius(unit.size) * 2)
}
