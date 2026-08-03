import { describe, expect, it } from 'vitest'
import {
  createSimulatorUnit,
  getTier1CommandPoints,
  getTier1SetupError,
  isTier1DeploymentBlocked,
  normalizeCommandLimit,
} from '@/app/simulator2/simulator-tier1'
import type { Team, UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'

function row(id: string, team: Team, unitType: UnitTypeKey): UnitRow {
  return {
    id,
    colony_id: team,
    unit_type: unitType,
    hp_current: 1,
    tier: 1,
    upgrade_path: [],
    grid_x: '90',
    grid_y: team === 'attacker' ? '930' : '270',
  }
}

describe('simulator2 Tier 1 setup', () => {
  it('assigns deterministic free base slots in each deployment zone', () => {
    const firstAttacker = createSimulatorUnit('attacker', 'marine', [], 'tier1')
    const secondAttacker = createSimulatorUnit('attacker', 'medic', [firstAttacker], 'tier1')
    const firstDefender = createSimulatorUnit('defender', 'marine', [], 'tier1')

    expect([firstAttacker.grid_x, firstAttacker.grid_y]).toEqual(['90', '930'])
    expect([secondAttacker.grid_x, secondAttacker.grid_y]).toEqual(['210', '930'])
    expect([firstDefender.grid_x, firstDefender.grid_y]).toEqual(['90', '270'])
  })

  it('skips an automatic base slot that intersects an obstacle', () => {
    const blockedFirstSlot = [{ x: 90, y: 270, radius: 20 }]
    const defender = createSimulatorUnit('defender', 'marine', [], 'tier1', blockedFirstSlot)

    expect([defender.grid_x, defender.grid_y]).toEqual(['210', '270'])
  })

  it('counts every Tier 1 squad as one point and ignores QA units', () => {
    expect(getTier1CommandPoints([
      row('marine', 'attacker', 'marine'),
      row('walker', 'attacker', 'light_walker'),
      row('legacy-officer', 'attacker', 'officer'),
      row('exo', 'attacker', 'exosuit'),
    ])).toBe(2)
  })

  it('requires equal non-zero armies within the selected cap', () => {
    const attacker = [row('a-1', 'attacker', 'marine'), row('a-2', 'attacker', 'medic')]
    const defender = [row('d-1', 'defender', 'marine'), row('d-2', 'defender', 'sniper')]

    expect(getTier1SetupError(attacker, defender, 6)).toBeNull()
    expect(getTier1SetupError(attacker, defender.slice(0, 1), 6)).toContain('одинаковое')
    expect(getTier1SetupError(attacker, [], 6)).toContain('каждой стороне')
    expect(getTier1SetupError(attacker, defender, 1)).toContain('превышает')
  })

  it('normalizes the adjustable command limit to the 3-12 contract', () => {
    expect(normalizeCommandLimit(1)).toBe(3)
    expect(normalizeCommandLimit(7.6)).toBe(8)
    expect(normalizeCommandLimit(20)).toBe(12)
  })

  it('rejects the screenshot deployment that starts inside the seed-12345 crater', () => {
    const marine = { ...row('marine', 'defender', 'marine'), grid_x: '270', grid_y: '570' }
    const scout = { ...row('scout', 'defender', 'scout_drone'), grid_x: '270', grid_y: '510' }
    const crater = [{ x: 256.82, y: 537.63, radius: 39.35 }]
    const attackers = Array.from({ length: 2 }, (_, index) => row(`attacker-${index}`, 'attacker', 'marine'))

    expect(isTier1DeploymentBlocked(marine, crater)).toBe(true)
    expect(isTier1DeploymentBlocked(scout, crater)).toBe(true)
    expect(getTier1SetupError(attackers, [marine, scout], 6, crater)).toContain('препятствием')
  })
})
