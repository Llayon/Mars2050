import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { TIER1_BALANCE_SCENARIOS } from '@/domains/combat/combat.tier1-scenarios'
import type { BattleResult, Team, UnitRow } from '@/domains/combat/combat.types'
import { FIELD_HEIGHT, generateObstacles } from '@/domains/combat/combat.utils'

describe('combat mirror gate', () => {
  it('keeps the symmetric marine baseline mirrored exactly', () => {
    const scenario = findScenario('tier1_marine_baseline_duel')
    const normal = simulateBattle(cloneRows(scenario.attackers), cloneRows(scenario.defenders), 101, [])
    const mirrored = simulateBattle(mirrorRows(scenario.defenders, 'attacker'), mirrorRows(scenario.attackers, 'defender'), 101, [])

    expect(normal.winner).toBe(mirrored.winner)
    expect(remainingHp(normal)).toBeCloseTo(remainingHp(mirrored), 6)
  })

  it.each(['tier1_scout_focus_fire', 'tier1_flamethrower_vs_shock_screen'])('swaps the winning composition for %s', scenarioId => {
    const scenario = findScenario(scenarioId)
    const obstacles = generateObstacles(12345)
    const normal = simulateBattle(cloneRows(scenario.attackers), cloneRows(scenario.defenders), 12345, obstacles)
    const mirrored = simulateBattle(mirrorRows(scenario.defenders, 'attacker'), mirrorRows(scenario.attackers, 'defender'), 12345, mirrorObstacles(obstacles))

    expect(normal.winner).not.toBe('draw')
    expect(mirrored.winner).toBe(normal.winner === 'attacker' ? 'defender' : 'attacker')
  })
})

function findScenario(id: string) {
  const scenario = TIER1_BALANCE_SCENARIOS.find(candidate => candidate.id === id)
  if (!scenario) throw new Error(`Missing scenario: ${id}`)
  return scenario
}

function mirrorRows(rows: UnitRow[], team: Team): UnitRow[] {
  return rows.map(unit => ({ ...unit, id: `mirror-${unit.id}`, colony_id: team, upgrade_path: [...(unit.upgrade_path ?? [])], grid_y: String(FIELD_HEIGHT - Number(unit.grid_y)) }))
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(unit => ({ ...unit, upgrade_path: [...(unit.upgrade_path ?? [])] }))
}

function mirrorObstacles(obstacles: { x: number; y: number; radius: number }[]) {
  return obstacles.map(obstacle => ({ ...obstacle, y: FIELD_HEIGHT - obstacle.y }))
}

function remainingHp(result: BattleResult): number {
  return result.survivors.reduce((total, unit) => total + unit.hp, 0)
}
