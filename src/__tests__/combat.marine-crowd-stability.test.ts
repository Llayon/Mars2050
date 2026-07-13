import { describe, expect, it } from 'vitest'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { BattleResult, UnitRow } from '@/domains/combat/combat.types'

describe('marine crowd stability', () => {
  it('keeps two marine squads per side from collapsing into a jittering blob', () => {
    const result = simulateMarineCrowd()
    const movement = collectVisibleMovementStats(result)

    expect(result.initialState).toHaveLength(32)
    expect(result.metrics?.firstAttackTick).not.toBeNull()
    expect(result.metrics?.averageOverlapRatio).toBeLessThan(0.18)
    expect(result.metrics?.severeOverlapSamples).toBeLessThan(120)
    expect(result.metrics?.targetSwitches).toBeLessThan(400)
    expect(result.metrics?.battleDurationTicks).toBeLessThan(140)
    expect(movement.depenetrationMoves).toBeLessThan(1200)
    expect(movement.visibleDirectionFlips).toBeLessThan(120)
  }, 30000)
})

function simulateMarineCrowd(): BattleResult {
  const preset = getSimulatorPreset('marine_crowd_qa')
  if (!preset) throw new Error('Missing marine_crowd_qa preset')
  return simulateBattle(cloneRows(preset.attackers), cloneRows(preset.defenders), 24680, [], [], [], { trackMetrics: true })
}

function collectVisibleMovementStats(result: BattleResult): { depenetrationMoves: number; visibleDirectionFlips: number } {
  let depenetrationMoves = 0
  let visibleDirectionFlips = 0
  const previousDirection = new Map<string, { x: number; y: number }>()

  for (const tick of result.logs) {
    const movementByUnit = new Map<string, { fromX: number; fromY: number; toX: number; toY: number }>()
    for (const action of tick.actions) {
      if (action.type !== 'move' && action.type !== 'knockback') continue
      if (action.motionKind === 'depenetration') depenetrationMoves++
      const current = movementByUnit.get(action.unitId) ?? {
        fromX: action.fromX ?? 0,
        fromY: action.fromY ?? 0,
        toX: action.fromX ?? 0,
        toY: action.fromY ?? 0,
      }
      current.toX = action.toX ?? current.toX
      current.toY = action.toY ?? current.toY
      movementByUnit.set(action.unitId, current)
    }

    for (const [unitId, movement] of movementByUnit) {
      const dx = movement.toX - movement.fromX
      const dy = movement.toY - movement.fromY
      const mag = Math.hypot(dx, dy)
      if (mag <= 0.1) continue
      const previous = previousDirection.get(unitId)
      if (previous && previous.x * dx + previous.y * dy < -0.5) visibleDirectionFlips++
      previousDirection.set(unitId, { x: dx / mag, y: dy / mag })
    }
  }

  return { depenetrationMoves, visibleDirectionFlips }
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}
