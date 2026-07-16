import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { UPGRADES, type UpgradeConfig } from '@/domains/combat/combat.upgrades'
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
      },
      {
        id: 'a2',
        colony_id: 'c1',
        unit_type: 'exosuit',
        hp_current: 120,
        grid_x: '0',
        grid_y: '1',
        tier: 1,
        upgrade_path: [],
      },
      {
        id: 'a3',
        colony_id: 'c1',
        unit_type: 'exosuit',
        hp_current: 120,
        grid_x: '0',
        grid_y: '2',
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

    const result = simulateBattle(attackerUnits, defenderUnits, 123, [])

    expect(result.winner).toBe('attacker')
    expect(result.survivors.length).toBeGreaterThan(0)
    expect(result.survivors[0].id).toContain('a')
    expect(result.logs.length).toBeGreaterThan(0)
    
    // Check that we have movement logs then attack logs
    const hasMove = result.logs.some(l => l.actions.some(a => a.type === 'move'))
    const hasAttack = result.logs.some(l => l.actions.some(a => a.type === 'attack'))
    const hasDie = result.logs.some(l => l.actions.some(a => a.type === 'die'))

    expect(hasMove).toBe(true)
    expect(hasAttack).toBe(true)
    expect(hasDie).toBe(true)
  })

  it('should result in a draw if time runs out with both sides alive', () => {
    const attackerUnits: UnitRow[] = [
      {
        id: 'a1',
        colony_id: 'c1',
        unit_type: 'marine',
        hp_current: 1000000,
        grid_x: '0',
        grid_y: '0',
        tier: 1,
        upgrade_path: ['god_mode'],
      }
    ]

    const defenderUnits: UnitRow[] = [
      {
        id: 'd1',
        colony_id: 'c2',
        unit_type: 'marine',
        hp_current: 1000000,
        grid_x: '6',
        grid_y: '0',
        tier: 1,
        upgrade_path: ['god_mode'],
      }
    ]

    const tempUpgrade = UPGRADES['god_mode'];
    const godModeUpgrade: UpgradeConfig = {
       id: 'god_mode',
       name: 'God',
       description: 'Test-only health multiplier',
       cost: 0,
       allowedUnits: ['marine'],
       modifiers: { hpMult: 100000 }
    };

    UPGRADES['god_mode'] = godModeUpgrade

    try {
      const result = simulateBattle(attackerUnits, defenderUnits)

      // Reached MAX_TICKS with both teams still represented.
      expect(result.winner).toBe('draw')
      expect(result.survivors.length).toBeGreaterThan(0)
    } finally {
      if (tempUpgrade === undefined) delete UPGRADES['god_mode'];
      else UPGRADES['god_mode'] = tempUpgrade;
    }
  })
})
