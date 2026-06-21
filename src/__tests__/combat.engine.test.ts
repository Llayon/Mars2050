import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'

describe('combat.engine', () => {
  it('should simulate a simple battle where attacker wins', () => {
    const attackerUnits: UnitRow[] = [
      {
        id: 'a1',
        colony_id: 'c1',
        unit_type: 'exosuit', // high hp, high attack
        hp_current: 120,
        grid_x: '0',
        grid_y: '0',
        tier: 1,
        upgrade_path: [],
      }
    ]

    const defenderUnits: UnitRow[] = [
      {
        id: 'd1',
        colony_id: 'c2',
        unit_type: 'marine', // low hp, low attack
        hp_current: 40,
        grid_x: '6',
        grid_y: '0',
        tier: 1,
        upgrade_path: [],
      }
    ]

    const result = simulateBattle(attackerUnits, defenderUnits)

    expect(result.winner).toBe('attacker')
    expect(result.survivors.length).toBe(1)
    expect(result.survivors[0].id).toBe('a1')
    expect(result.logs.length).toBeGreaterThan(0)
    
    // Check that we have movement logs then attack logs
    const hasMove = result.logs.some(l => l.actions.some(a => a.type === 'move'))
    const hasAttack = result.logs.some(l => l.actions.some(a => a.type === 'attack'))
    const hasDie = result.logs.some(l => l.actions.some(a => a.type === 'die'))

    expect(hasMove).toBe(true)
    expect(hasAttack).toBe(true)
    expect(hasDie).toBe(true)
  })

  it('should result in defender winning if time runs out', () => {
    const attackerUnits: UnitRow[] = [
      {
        id: 'a1',
        colony_id: 'c1',
        unit_type: 'marine',
        hp_current: 4000, // impossible to kill
        grid_x: '0',
        grid_y: '0',
        tier: 1,
        upgrade_path: [],
      }
    ]

    const defenderUnits: UnitRow[] = [
      {
        id: 'd1',
        colony_id: 'c2',
        unit_type: 'marine',
        hp_current: 4000, // impossible to kill
        grid_x: '6',
        grid_y: '0',
        tier: 1,
        upgrade_path: [],
      }
    ]

    const result = simulateBattle(attackerUnits, defenderUnits)
    
    // Reached MAX_TICKS without kills
    expect(result.winner).toBe('defender')
    expect(result.survivors.length).toBe(2)
  })
})
