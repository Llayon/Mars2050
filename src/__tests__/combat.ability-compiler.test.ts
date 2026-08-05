import { describe, expect, it } from 'vitest'
import { AbilityCompilationError, compileAbilityDefinitions } from '@/domains/combat/combat.ability-compiler'
import { createLegacyAbilityDefinitions } from '@/domains/combat/combat.ability-legacy'
import type { UnitBaseStats } from '@/domains/combat/combat.types'

describe('declarative ability compiler', () => {
  it('compiles legacy hit effects into a stable program', () => {
    const stats: UnitBaseStats = {
      hp: 10, attack: 4, defense: 1, speed: 3, range: 2, attackType: 'single',
      statusOnHit: [{ type: 'burn', duration: 30, value: 3 }],
      knockbackOnHit: { radius: 2, strength: 1, maxTargets: 2 },
    }
    const program = compileAbilityDefinitions(createLegacyAbilityDefinitions('test', stats))
      .find(candidate => candidate.id === 'test:legacy:on_hit')!
    expect(program.id).toBe('test:legacy:on_hit')
    expect(program.trigger.kind).toBe('hit')
    expect(program.groups).toHaveLength(1)
    expect(program.groups[0].effects[0]).toMatchObject({ kind: 'apply_status', status: 'burn' })

    const geometryProgram = compileAbilityDefinitions(createLegacyAbilityDefinitions('test', stats))
      .find(candidate => candidate.id === 'test:legacy:geometry')!
    expect(geometryProgram.groups).toHaveLength(1)
    expect(geometryProgram.groups[0].selector).toMatchObject({ kind: 'primary_target' })
    expect(geometryProgram.groups[0].effects[0]).toMatchObject({ kind: 'legacy_geometry', geometry: 'displacement' })
  })

  it('sorts compiled programs deterministically by priority and id', () => {
    const definitions = [
      { id: 'z', trigger: { kind: 'hit' as const }, priority: 1, effects: [{ selector: { kind: 'primary_target' as const }, effects: [{ kind: 'mark_target' as const, duration: 1 }] }] },
      { id: 'a', trigger: { kind: 'hit' as const }, priority: 1, effects: [{ selector: { kind: 'primary_target' as const }, effects: [{ kind: 'mark_target' as const, duration: 1 }] }] },
    ]
    expect(compileAbilityDefinitions(definitions).map(program => program.id)).toEqual(['a', 'z'])
  })

  it('rejects duplicate ids and unsupported no-op combinations', () => {
    expect(() => compileAbilityDefinitions([
      { id: 'same', trigger: { kind: 'hit' }, effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'mark_target', duration: 1 }] }] },
      { id: 'same', trigger: { kind: 'hit' }, effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'mark_target', duration: 1 }] }] },
    ])).toThrowError(AbilityCompilationError)
    expect(() => compileAbilityDefinitions([
      { id: 'invalid', trigger: { kind: 'weapon_attack' }, effects: [{ selector: { kind: 'self' }, effects: [{ kind: 'mark_target', duration: 1 }] }] },
    ])).toThrow(/cannot execute/)
  })

  it('keeps explicit attack multiplier damage expressions in the compiled program', () => {
    const [program] = compileAbilityDefinitions([{
      id: 'multiplier',
      trigger: { kind: 'projectile_impact' },
      effects: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'damage', expression: { kind: 'attack_multiplier', multiplier: 1 } }] }],
    }])
    expect(program.groups[0]?.effects[0]).toEqual({ kind: 'damage', expression: { kind: 'attack_multiplier', multiplier: 1 } })
  })

  it('rejects incompatible primary geometry combinations', () => {
    expect(() => compileAbilityDefinitions([{
      id: 'geometry-conflict',
      trigger: { kind: 'weapon_attack' },
      effects: [{
        selector: { kind: 'primary_target' },
        effects: [
          { kind: 'barrage_attack', config: { impacts: 4, radius: 70, spreadRadius: 110, damageMultiplier: 0.45 } },
          { kind: 'line_pierce', config: { width: 1, damageMultiplier: 1 } },
        ],
      }],
    }])).toThrowError(expect.objectContaining({ code: 'INCOMPATIBLE_GEOMETRY' }))
  })

  it('rejects invalid authored geometry numbers', () => {
    expect(() => compileAbilityDefinitions([{
      id: 'invalid-barrage',
      trigger: { kind: 'weapon_attack' },
      effects: [{
        selector: { kind: 'primary_target' },
        effects: [{ kind: 'barrage_attack', config: { impacts: 4, radius: Number.NaN, spreadRadius: 110, damageMultiplier: 0.45 } }],
      }],
    }])).toThrowError(expect.objectContaining({ code: 'INVALID_NUMERIC_VALUE' }))
  })
})
