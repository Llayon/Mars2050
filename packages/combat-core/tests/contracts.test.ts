import { describe, expect, it } from 'vitest'
import { battleInputSchema, battleRulesSchema, scheduledEffectSchema } from '../src/contracts/battle.contracts.js'
import { attackTypeSchema, unitDefinitionSchema } from '../src/contracts/unit.contracts.js'

describe('combat-core public contracts', () => {
  it('accepts a minimal valid BattleInput', () => {
    const parsed = battleInputSchema.safeParse({
      seed: 7,
      definitions: {},
      units: [],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a non-integer seed', () => {
    const parsed = battleInputSchema.safeParse({ seed: 'seven', definitions: {}, units: [] })
    expect(parsed.success).toBe(false)
  })

  it('applies unit definition defaults', () => {
    const parsed = unitDefinitionSchema.parse({
      id: 'squire',
      name: 'Squire',
      baseStats: { hp: 50, attack: 5, defense: 1, speed: 3, range: 1 },
    })
    expect(parsed.baseStats.attackType).toBe('single')
    expect(parsed.squadSize).toBe(1)
    expect(parsed.formation).toBe('grid')
  })

  it('accepts every declared attack type', () => {
    for (const t of ['single', 'aoe', 'beam', 'spread', 'spawn', 'heal'] as const) {
      expect(attackTypeSchema.safeParse(t).success).toBe(true)
    }
  })

  it('requires tick on scheduled effects', () => {
    const ok = scheduledEffectSchema.safeParse({ id: 'e1', tick: 5, team: 'attacker', type: 'orbital_strike', value: 10 })
    expect(ok.success).toBe(true)
    const bad = scheduledEffectSchema.safeParse({ id: 'e1', team: 'attacker', type: 'orbital_strike', value: 10 })
    expect(bad.success).toBe(false)
  })

  it('applies battle rules defaults', () => {
    const parsed = battleRulesSchema.parse({})
    expect(parsed.timeoutPolicy).toBe('draw')
    expect(parsed.defenseResolutionMode).toBe('v9_snapshot')
  })
})
