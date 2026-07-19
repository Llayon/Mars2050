import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'

describe('combat anti-stealth upgrade', () => {
  it('maps sensor suite upgrades into runtime support auras', () => {
    const attackers: UnitRow[] = [{
      id: 'officer', colony_id: 'a', unit_type: 'officer', hp_current: 80,
      grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['sensor_suite'],
    }]
    const defenders: UnitRow[] = [{
      id: 'ghost', colony_id: 'd', unit_type: 'stealth_operative', hp_current: 100,
      grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [],
    }]

    const result = simulateBattle(attackers, defenders, 29, [])
    const officer = result.initialState.find(unit => unit.id === 'officer')

    expect(officer?.supportAuras).toContainEqual({
      type: 'reveal', radius: 220, value: 0, duration: 12,
      interval: 5, target: 'enemies', targetTags: ['stealth'],
    })
    expect(officer?.supportAuras?.some(aura => aura.type === 'haste')).toBe(true)
  })
})
