import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'

const MARINE_SQUAD_SIZE = 8

describe('combat performance smoke tests', () => {
  it.each([
    { label: '100-ish', rowsPerTeam: 6, maxMs: 10000 },
    { label: '200-ish', rowsPerTeam: 13, maxMs: 20000 },
    { label: '400-ish', rowsPerTeam: 25, maxMs: 45000 }
  ])('simulates $label units within a generous threshold', ({ rowsPerTeam, maxMs }) => {
    const attackers = makeUnits('atk', rowsPerTeam, 'attacker')
    const defenders = makeUnits('def', rowsPerTeam, 'defender')
    const expectedSimUnits = rowsPerTeam * 2 * MARINE_SQUAD_SIZE

    const startedAt = performance.now()
    const result = simulateBattle(attackers, defenders, 12345, [])
    const durationMs = performance.now() - startedAt

    expect(result.initialState.length).toBe(expectedSimUnits)
    expect(result.logs.length).toBeGreaterThan(0)
    expect(durationMs).toBeLessThan(maxMs)
  }, 60000)
})

function makeUnits(prefix: string, count: number, team: 'attacker' | 'defender'): UnitRow[] {
  const baseY = team === 'attacker' ? 550 : 650
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    colony_id: team,
    unit_type: 'marine',
    tier: 1,
    upgrade_path: [],
    hp_current: 10,
    grid_x: String(140 + (index % 10) * 36),
    grid_y: String(baseY + Math.floor(index / 10) * 28)
  }))
}
