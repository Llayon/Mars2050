import type { BattleAction } from '@/domains/combat/combat.types'

export interface ReplayMovementUnit {
  sX: number
  sY: number
  tX: number
  tY: number
}

export function applyReplayMovement(
  unit: ReplayMovementUnit,
  action: BattleAction,
  movedUnitIds: Set<string>
): void {
  if (!movedUnitIds.has(action.unitId)) {
    unit.sX = action.fromX ?? unit.tX
    unit.sY = action.fromY ?? unit.tY
    movedUnitIds.add(action.unitId)
  }

  unit.tX = action.toX ?? unit.tX
  unit.tY = action.toY ?? unit.tY
}
