import { describe, it, expect } from 'vitest'
import { translateMarsBattleInput } from '../domains/combat/combat.input-translator'
import { createRuntimeSquad } from '../domains/combat/combat.squad-factory'
import { PRNG } from '../domains/combat/combat.utils'
import { simulateCombat } from '@mars2050/combat-core'
import type { UnitRow } from '../domains/combat/combat.types'
import type { UnitsType } from '@/types/database'

function makeRow(id: string, unit_type: UnitsType = 'marine', overrides: Partial<UnitRow> = {}): UnitRow {
  return {
    id,
    colony_id: 'colony-1',
    unit_type,
    tier: 1,
    upgrade_path: [],
    grid_x: '300',
    grid_y: '700',
    hp_current: 100,
    ...overrides,
  }
}

describe('Mars Adapter: Prepared loadout emission and parity', () => {
  it('translateMarsBattleInput emits preparedStats for all units', () => {
    const attackers = [makeRow('a1', 'marine', { tier: 2, upgrade_path: ['heavy_armor'] })]
    const defenders = [makeRow('d1', 'marine', { tier: 1 })]

    const input = translateMarsBattleInput(attackers, defenders, 42, [], [], [], { maxTicks: 1 })

    expect(input.units).toHaveLength(2)
    for (const unit of input.units) {
      expect(unit.preparedStats).toBeDefined()
      expect(unit.preparedStats!.hp).toBeGreaterThan(0)
      expect(unit.preparedStats!.defense).toBeDefined()
      expect(unit.preparedStats!.speed).toBeDefined()
    }

    const a1 = input.units.find(u => u.instanceId === 'a1')!
    expect(a1.rank).toBe(2)
    expect(a1.upgradeIds).toEqual(['heavy_armor'])
    expect(a1.preparedStats!.defense).toBeGreaterThan(2) // heavy_armor grants extra defense
  })

  it('createRuntimeSquad and translateMarsBattleInput agree on range_enhancement range', () => {
    const rowWithUpgrade = makeRow('u1', 'marine', { upgrade_path: ['range_enhancement'] })
    const rng = new PRNG(123)

    const squad = createRuntimeSquad(rowWithUpgrade, 'attacker', rng)
    expect(squad).toHaveLength(8)
    expect(squad[0].range).toBe(240)

    const translated = translateMarsBattleInput([rowWithUpgrade], [makeRow('d1')], 123, [], [], [], { maxTicks: 1 })
    const translatedUnit = translated.units.find(u => u.instanceId === 'u1')!
    expect(translatedUnit.preparedStats!.range).toBe(240)
  })

  it('createRuntimeSquad and translateMarsBattleInput agree on sensor_suite reveal aura', () => {
    const rowWithSensor = makeRow('u1', 'scout_drone', { upgrade_path: ['sensor_suite'] })
    const rng = new PRNG(123)

    const squad = createRuntimeSquad(rowWithSensor, 'attacker', rng)
    expect(squad).toHaveLength(1)
    expect(squad[0].supportAuras?.some(a => a.type === 'reveal')).toBe(true)

    const translated = translateMarsBattleInput([rowWithSensor], [makeRow('d1')], 123, [], [], [], { maxTicks: 1 })
    const translatedUnit = translated.units.find(u => u.instanceId === 'u1')!
    expect(translatedUnit.upgradeIds).toContain('sensor_suite')
    expect(translatedUnit.preparedStats?.supportAuras?.some(a => a.type === 'reveal')).toBe(true)

    const detached = structuredClone(translated)
    detached.units[0].upgradeIds = []
    const simResult = simulateCombat(detached)
    const scout = simResult.initialState.find(u => u.id === 'u1')!
    expect(scout.supportAuras?.some(a => a.type === 'reveal')).toBe(true)
  })

  it('createRuntimeSquad normalizes legacy tier: 2 into rank: 2', () => {
    const rowTier2 = makeRow('u1', 'marine', { tier: 2 })
    const rng = new PRNG(123)

    const squad = createRuntimeSquad(rowTier2, 'attacker', rng)
    expect(squad).toHaveLength(8)
    expect(squad[0].rank).toBe(2)

    const translated = translateMarsBattleInput([rowTier2], [makeRow('d1')], 123, [], [], [], { maxTicks: 1 })
    const translatedUnit = translated.units.find(u => u.instanceId === 'u1')!
    expect(translatedUnit.rank).toBe(2)
  })
})
