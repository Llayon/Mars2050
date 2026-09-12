import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { simulateCombat } from '@/domains/combat/combat.facade'
import { translateMarsBattleInput } from '@/domains/combat/combat.input-translator'
import { mapCombatRunResultToBattleResult } from '@/domains/combat/combat.compat-mapper'
import { buildMarsUnitDefinitions } from '@/domains/combat/combat.unit-definitions'
import type { UnitRow } from '@/domains/combat/combat.types'

describe('Combat Facade and Mars Compatibility (Milestone E5)', () => {
  const attackers: UnitRow[] = [
    { colony_id: 'col_1', hp_current: 35, id: 'att_m1', unit_type: 'marine', grid_x: '120', grid_y: '800' },
    { colony_id: 'col_1', hp_current: 35, id: 'att_m2', unit_type: 'marine', grid_x: '200', grid_y: '800' },
  ]
  const defenders: UnitRow[] = [
    { colony_id: 'col_2', hp_current: 35, id: 'def_m1', unit_type: 'marine', grid_x: '120', grid_y: '200' },
  ]

  it('translates Mars battle inputs into valid core BattleInput contracts', () => {
    const input = translateMarsBattleInput(
      attackers,
      defenders,
      4242,
      [],
      ['orbital_strike'],
      ['mass_heal'],
      { maxTicks: 500, timeoutPolicy: 'defender_holds', defenseResolutionMode: 'v9_snapshot' },
    )

    expect(input.seed).toBe(4242)
    expect(input.arena.width).toBe(600)
    expect(input.arena.height).toBe(1200)
    expect(input.rules.maxTicks).toBe(500)
    expect(input.rules.timeoutPolicy).toBe('defender_win')
    expect(input.rules.defenseResolutionMode).toBe('v9_snapshot')
    expect(input.units).toHaveLength(3)
    expect(input.units[0].instanceId).toBe('att_m1')
    expect(input.units[0].team).toBe('attacker')
    expect(input.units[1].instanceId).toBe('att_m2')
    expect(input.units[1].team).toBe('attacker')
    expect(input.units[2].instanceId).toBe('def_m1')
    expect(input.units[2].team).toBe('defender')
    expect(input.scheduledEffects).toHaveLength(2)
    expect(input.scheduledEffects[0].type).toBe('orbital_strike')
    expect(input.scheduledEffects[1].type).toBe('mass_heal')
  })

  it('simulates combat directly via the facade and maps back through compatibility mapper', () => {
    const input = translateMarsBattleInput(attackers, defenders, 9999, [])
    const coreResult = simulateCombat(input)

    expect(coreResult.seed).toBe(9999)
    expect(['attacker', 'defender', 'draw']).toContain(coreResult.winner)
    expect(coreResult.initialState.length).toBeGreaterThan(0)
    expect(coreResult.logs.length).toBeGreaterThan(0)

    const battleResult = mapCombatRunResultToBattleResult(coreResult, input.arena.obstacles)
    expect(battleResult.winner).toBe(coreResult.winner)
    expect(battleResult.seed).toBe(coreResult.seed)
    expect(battleResult.elapsedTicks).toBe(coreResult.elapsedTicks)
    expect(battleResult.terminationReason).toBe(coreResult.terminationReason)
    expect(battleResult.simulationVersion).toBe(coreResult.engineVersion)
    expect(battleResult.simulationRevision).toBe(coreResult.engineRevision)
  })

  it('preserves survivor identities and HP integrity across facade execution', () => {
    const battleResult = simulateBattle(attackers, defenders, 12345, [])

    expect(battleResult.winner).toBe('attacker')
    expect(battleResult.initialState).toHaveLength(24) // 16 attackers + 8 defenders
    expect(battleResult.survivors.length).toBeGreaterThan(0)

    for (const survivor of battleResult.survivors) {
      expect(survivor.hp).toBeGreaterThan(0)
      expect(survivor.team).toBe('attacker')
      expect(survivor.id).toBeDefined()
    }
  })

  it('builds comprehensive unit definitions for all Mars unit types', () => {
    const defs = buildMarsUnitDefinitions()
    expect(defs.marine).toBeDefined()
    expect(defs.marine.name).toBe('Морпех')
    expect(defs.marine.squadSize).toBe(8)
    expect(defs.alien_bug).toBeDefined()
    expect(defs.wall).toBeDefined()
  })
})
