import { describe, expect, it } from 'vitest'
import { applyReplayMovement, type ReplayMovementUnit } from '@/components/game/battle-replay-movement'
import type { BattleAction } from '@/domains/combat/combat.types'

function move(unitId: string, fromX: number, fromY: number, toX: number, toY: number, motionKind?: BattleAction['motionKind']): BattleAction {
  return { unitId, type: 'move', fromX, fromY, toX, toY, motionKind }
}

describe('battle replay movement aggregation', () => {
  it('keeps the first movement origin and last movement target inside one replay tick', () => {
    const unit: ReplayMovementUnit = { sX: 10, sY: 20, tX: 10, tY: 20 }
    const moved = new Set<string>()

    applyReplayMovement(unit, move('marine', 10, 20, 16, 26, 'locomotion'), moved)
    applyReplayMovement(unit, move('marine', 16, 26, 14, 25, 'depenetration'), moved)

    expect(unit).toEqual({ sX: 10, sY: 20, tX: 14, tY: 25 })
  })

  it('tracks movement origins independently per unit', () => {
    const first: ReplayMovementUnit = { sX: 0, sY: 0, tX: 0, tY: 0 }
    const second: ReplayMovementUnit = { sX: 100, sY: 100, tX: 100, tY: 100 }
    const moved = new Set<string>()

    applyReplayMovement(first, move('a', 0, 0, 10, 0), moved)
    applyReplayMovement(second, move('b', 100, 100, 90, 100), moved)

    expect(first).toEqual({ sX: 0, sY: 0, tX: 10, tY: 0 })
    expect(second).toEqual({ sX: 100, sY: 100, tX: 90, tY: 100 })
  })
})
