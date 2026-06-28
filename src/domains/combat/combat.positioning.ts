import type { SimUnit } from './combat.sim.types'
import { getMeleeEngagementPoint, isMeleeEngagementReady, isMeleeWaitingReady } from './combat.melee-engagement'
import { getDistance } from './combat.utils'

const MELEE_RANGE = 60
export interface PositioningDecision {
  point: { x: number; y: number }
  shouldMove: boolean
  combatInRange: boolean
}

export function getPositioningDecision(
  unit: SimUnit,
  target: SimUnit,
  distEdge: number,
  targetRadius: number,
  myRadius: number
): PositioningDecision {
  const targetPoint = { x: target.x, y: target.y }
  if (unit.speed <= 0 || unit.attackType === 'spawn') return { point: targetPoint, shouldMove: false, combatInRange: true }

  const combatInRange = unit.attackType === 'heal'
    ? target.hp < target.maxHp && distEdge <= unit.range
    : distEdge <= unit.range

  if (unit.range <= MELEE_RANGE && unit.attackType !== 'heal') {
    const ready = isMeleeEngagementReady(unit, target)
    const waitingReady = isMeleeWaitingReady(unit, target)
    return {
      point: ready ? targetPoint : getMeleeEngagementPoint(unit, target),
      shouldMove: ready ? distEdge > unit.range : !waitingReady,
      combatInRange: ready ? combatInRange : waitingReady,
    }
  }

  if (unit.attackType === 'heal') {
    const shouldMove = distEdge > unit.range
    return { point: getPreferredRangePoint(unit, target, targetRadius, myRadius, 0.65), shouldMove, combatInRange }
  }

  if (distEdge > unit.range) return { point: targetPoint, shouldMove: true, combatInRange: false }

  return {
    point: targetPoint,
    shouldMove: false,
    combatInRange,
  }
}

function getPreferredRangePoint(
  unit: SimUnit,
  target: SimUnit,
  targetRadius: number,
  myRadius: number,
  ratio: number
): { x: number; y: number } {
  const dx = unit.x - target.x
  const dy = unit.y - target.y
  const mag = Math.max(1, getDistance(unit.x, unit.y, target.x, target.y))
  const preferred = targetRadius + myRadius + Math.max(0, unit.range * ratio)
  return {
    x: target.x + (dx / mag) * preferred,
    y: target.y + (dy / mag) * preferred,
  }
}
