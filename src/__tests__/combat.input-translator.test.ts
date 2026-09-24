import { describe, it, expect } from 'vitest'
import { mapUnitRowsToSpawnSpecs, translateMarsBattleInput } from '@/domains/combat/combat.input-translator'
import type { UnitRow } from '@/domains/combat/combat.types'
import { simulateCombat } from '@mars2050/combat-core'

describe('combat.input-translator — effective max HP and Mars compatibility', () => {
  it('preserves elevated currentHp for marine with heavy_armor up to effective max (46)', () => {
    const row: UnitRow = {
      id: 'marine_1',
      colony_id: 'c1',
      unit_type: 'marine',
      hp_current: 40,
      grid_x: '200',
      grid_y: '600',
      tier: 1,
      upgrade_path: ['heavy_armor'],
    }
    const specs = mapUnitRowsToSpawnSpecs([row], 'attacker')
    expect(specs).toHaveLength(1)
    expect(specs[0].currentHp).toBe(40)
  })

  it('clamps currentHp exceeding effective max (45.5) for marine with heavy_armor', () => {
    const row: UnitRow = {
      id: 'marine_2',
      colony_id: 'c1',
      unit_type: 'marine',
      hp_current: 50,
      grid_x: '200',
      grid_y: '600',
      tier: 1,
      upgrade_path: ['heavy_armor'],
    }
    const specs = mapUnitRowsToSpawnSpecs([row], 'attacker')
    expect(specs).toHaveLength(1)
    expect(specs[0].currentHp).toBeCloseTo(45.5, 5)
  })

  it('clamps currentHp to base max (35) for base marine without upgrades', () => {
    const row: UnitRow = {
      id: 'marine_3',
      colony_id: 'c1',
      unit_type: 'marine',
      hp_current: 40,
      grid_x: '200',
      grid_y: '600',
      tier: 1,
      upgrade_path: [],
    }
    const specs = mapUnitRowsToSpawnSpecs([row], 'attacker')
    expect(specs).toHaveLength(1)
    expect(specs[0].currentHp).toBe(35)
  })

  it('preserves unrounded float effective max HP (36.4) for marine with heavy_armor + stimpacks without truncation', () => {
    const row: UnitRow = {
      id: 'marine_multi',
      colony_id: 'c1',
      unit_type: 'marine',
      hp_current: 40,
      grid_x: '200',
      grid_y: '600',
      tier: 1,
      upgrade_path: ['heavy_armor', 'stimpacks'],
    }
    const specs = mapUnitRowsToSpawnSpecs([row], 'attacker')
    expect(specs).toHaveLength(1)
    expect(specs[0].currentHp).toBeCloseTo(36.4, 5)
  })

  it('allows complete battle translation with elevated HP unit to simulate successfully', () => {
    const attacker: UnitRow[] = [
      { id: 'att_1', colony_id: 'c1', unit_type: 'marine', hp_current: 40, grid_x: '200', grid_y: '600', tier: 1, upgrade_path: ['heavy_armor'] },
    ]
    const defender: UnitRow[] = [
      { id: 'def_1', colony_id: 'c1', unit_type: 'marine', hp_current: 35, grid_x: '200', grid_y: '200', tier: 1, upgrade_path: [] },
    ]
    const battleInput = translateMarsBattleInput(attacker, defender, 12345)
    expect(battleInput.units[0].currentHp).toBe(40)
    const result = simulateCombat(battleInput)
    expect(result.initialState.some(u => u.id.startsWith('att_1'))).toBe(true)
    expect(result.winner).toBeDefined()
  })
})
